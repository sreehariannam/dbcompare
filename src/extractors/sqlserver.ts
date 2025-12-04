import * as sql from 'mssql';
import {
  DbConnection,
  DatabaseSchema,
  TableSchema,
  Column,
  Index,
  ForeignKey,
  SchemaExtractor,
} from '../types';

/**
 * Configuration for parallel processing
 */
interface ExtractionConfig {
  batchSize: number;      // Number of tables to process in each batch
  maxConcurrency: number; // Maximum concurrent table extractions
}

/**
 * Extracts schema information from a SQL Server database with parallel processing
 */
export class SqlServerSchemaExtractor implements SchemaExtractor {
  private pool: sql.ConnectionPool;
  private config: DbConnection;
  private extractionConfig: ExtractionConfig;
  private isConnected: boolean = false;

  constructor(
    config: DbConnection,
    extractionConfig?: Partial<ExtractionConfig>
  ) {
    this.config = config;

    // Create connection pool configuration
    this.pool = new sql.ConnectionPool({
      server: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      options: {
        encrypt: true, // Use encryption for Azure SQL
        trustServerCertificate: true, // For development/self-signed certs
        enableArithAbort: true,
      },
      pool: {
        max: extractionConfig?.maxConcurrency || 20,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    });

    // Default configuration optimized for large databases
    this.extractionConfig = {
      batchSize: extractionConfig?.batchSize || 100,           // Process 100 tables per batch
      maxConcurrency: extractionConfig?.maxConcurrency || 20,  // 20 parallel operations
    };
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    await this.pool.connect();
    this.isConnected = true;
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.pool.close();
      this.isConnected = false;
    }
  }

  /**
   * Extract complete database schema with parallel processing
   */
  async extractSchema(): Promise<DatabaseSchema> {
    const tables = await this.getTables();
    const tableSchemas = new Map<string, TableSchema>();

    console.log(`\nExtracting schema for ${tables.length} tables...`);

    // Process tables in batches to avoid overwhelming the database
    const batches = this.createBatches(tables, this.extractionConfig.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNum = i + 1;
      const totalBatches = batches.length;

      console.log(`\nProcessing batch ${batchNum}/${totalBatches} (${batch.length} tables)...`);

      // Process tables in parallel within each batch
      const batchResults = await this.processBatchParallel(batch, batchNum, totalBatches);

      // Add results to the map
      for (const tableSchema of batchResults) {
        tableSchemas.set(tableSchema.name, tableSchema);
      }

      const progress = Math.round((batchNum / totalBatches) * 100);
      console.log(`✓ Batch ${batchNum}/${totalBatches} completed. Overall progress: ${progress}% (${tableSchemas.size}/${tables.length} tables)\n`);
    }

    console.log(`Schema extraction completed.\n`);
    return { tables: tableSchemas };
  }

  /**
   * Create batches from an array
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a batch of tables in parallel with concurrency control
   */
  private async processBatchParallel(tableNames: string[], batchNum: number, totalBatches: number): Promise<TableSchema[]> {
    const results: TableSchema[] = [];
    const executing: Promise<void>[] = [];
    let index = 0;
    let completed = 0;
    const total = tableNames.length;
    const startTime = Date.now();

    const processNext = async (): Promise<void> => {
      if (index >= tableNames.length) return;

      const currentIndex = index++;
      const tableName = tableNames[currentIndex];

      try {
        const schema = await this.extractTableSchema(tableName);
        results[currentIndex] = schema;
        completed++;

        // Show progress every 10 tables or on last table
        if (completed % 10 === 0 || completed === total) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const rate = (completed / (Date.now() - startTime) * 1000).toFixed(1);
          console.log(`  Batch ${batchNum}/${totalBatches}: ${completed}/${total} tables (${rate} tables/sec, ${elapsed}s elapsed)`);
        }
      } catch (error) {
        console.error(`Error extracting schema for table ${tableName}:`, error);
        throw error;
      }
    };

    // Start initial batch of workers up to maxConcurrency
    for (let i = 0; i < Math.min(this.extractionConfig.maxConcurrency, tableNames.length); i++) {
      const worker = (async () => {
        while (index < tableNames.length) {
          await processNext();
        }
      })();
      executing.push(worker);
    }

    // Wait for all workers to complete
    await Promise.all(executing);

    return results;
  }

  /**
   * Extract schema for a single table
   */
  private async extractTableSchema(tableName: string): Promise<TableSchema> {
    const startTime = Date.now();

    // Run all queries for this table in parallel with timing
    const [columns, indexData, foreignKeys] = await Promise.all([
      this.timedQuery('columns', () => this.getColumns(tableName)),
      this.timedQuery('indexes', () => this.getIndexData(tableName)),
      this.timedQuery('foreignKeys', () => this.getForeignKeys(tableName)),
    ]);

    // Extract both indexes and primary key from the same index data (no extra query)
    const { indexes, primaryKey } = this.processIndexData(indexData);

    const elapsed = Date.now() - startTime;
    if (elapsed > 5000) {
      console.log(`  ⚠️  Table "${tableName}" took ${(elapsed / 1000).toFixed(1)}s to extract`);
    }

    return {
      name: tableName,
      columns,
      indexes,
      foreignKeys,
      primaryKey,
    };
  }

  /**
   * Execute a query with timing information
   */
  private async timedQuery<T>(queryName: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const elapsed = Date.now() - start;
      if (elapsed > 2000) {
        console.log(`    ⏱️  ${queryName} query took ${(elapsed / 1000).toFixed(1)}s`);
      }
      return result;
    } catch (error) {
      const elapsed = Date.now() - start;
      console.error(`    ❌ ${queryName} query failed after ${(elapsed / 1000).toFixed(1)}s:`, error);
      throw error;
    }
  }

  /**
   * Get list of all tables in the database
   */
  private async getTables(): Promise<string[]> {
    const query = `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND TABLE_CATALOG = @database
      ORDER BY TABLE_NAME;
    `;

    const request = this.pool.request();
    request.input('database', sql.VarChar, this.config.database);
    const result = await request.query(query);

    return result.recordset.map((row: any) => row.TABLE_NAME);
  }

  /**
   * Get all columns for a specific table
   */
  private async getColumns(tableName: string): Promise<Column[]> {
    const query = `
      SELECT
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.IS_NULLABLE,
        c.COLUMN_DEFAULT,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION,
        c.NUMERIC_SCALE
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_NAME = @tableName
        AND c.TABLE_CATALOG = @database
      ORDER BY c.ORDINAL_POSITION;
    `;

    const request = this.pool.request();
    request.input('tableName', sql.VarChar, tableName);
    request.input('database', sql.VarChar, this.config.database);
    const result = await request.query(query);

    return result.recordset.map((row: any) => ({
      name: row.COLUMN_NAME,
      type: this.getFullDataType(row),
      nullable: row.IS_NULLABLE === 'YES',
      defaultValue: row.COLUMN_DEFAULT,
      characterMaximumLength: row.CHARACTER_MAXIMUM_LENGTH,
      numericPrecision: row.NUMERIC_PRECISION,
      numericScale: row.NUMERIC_SCALE,
    }));
  }

  /**
   * Get full data type including precision/length
   */
  private getFullDataType(row: any): string {
    let type = row.DATA_TYPE.toLowerCase();

    if (['varchar', 'char', 'nvarchar', 'nchar'].includes(type) && row.CHARACTER_MAXIMUM_LENGTH) {
      if (row.CHARACTER_MAXIMUM_LENGTH === -1) {
        type = `${type}(max)`;
      } else {
        type = `${type}(${row.CHARACTER_MAXIMUM_LENGTH})`;
      }
    } else if (['decimal', 'numeric'].includes(type) && row.NUMERIC_PRECISION) {
      if (row.NUMERIC_SCALE) {
        type = `${type}(${row.NUMERIC_PRECISION},${row.NUMERIC_SCALE})`;
      } else {
        type = `${type}(${row.NUMERIC_PRECISION})`;
      }
    }

    return type;
  }

  /**
   * Get raw index data for a specific table
   */
  private async getIndexData(tableName: string): Promise<any[]> {
    const query = `
      SELECT
        i.name AS index_name,
        i.is_unique,
        i.is_primary_key,
        c.name AS column_name,
        ic.key_ordinal
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID(@tableName)
        AND i.type > 0  -- Exclude heap
      ORDER BY i.name, ic.key_ordinal;
    `;

    const request = this.pool.request();
    request.input('tableName', sql.VarChar, tableName);
    const result = await request.query(query);

    return result.recordset;
  }

  /**
   * Process index data to extract both indexes and primary key
   * This eliminates the need for a separate primary key query
   */
  private processIndexData(rows: any[]): { indexes: Index[]; primaryKey: string[] | null } {
    // Group by index name
    const indexMap = new Map<string, Index>();
    let primaryKeyColumns: string[] | null = null;

    for (const row of rows) {
      const indexName = row.index_name;
      const columnName = row.column_name;
      const isUnique = row.is_unique;
      const isPrimary = row.is_primary_key;
      const keyOrdinal = row.key_ordinal;

      if (!indexMap.has(indexName)) {
        indexMap.set(indexName, {
          name: indexName,
          columns: [],
          isUnique: isUnique,
          isPrimary: isPrimary,
          definition: '', // Will be built below
        });
      }

      const index = indexMap.get(indexName)!;
      index.columns.push(columnName);

      // Extract primary key columns while processing
      if (isPrimary) {
        if (!primaryKeyColumns) {
          primaryKeyColumns = [];
        }
        primaryKeyColumns[keyOrdinal - 1] = columnName; // Maintain proper order
      }
    }

    // Build definitions
    for (const index of indexMap.values()) {
      if (index.isPrimary) {
        index.definition = `PRIMARY KEY (${index.columns.join(', ')})`;
      } else if (index.isUnique) {
        index.definition = `UNIQUE INDEX ${index.name} (${index.columns.join(', ')})`;
      } else {
        index.definition = `INDEX ${index.name} (${index.columns.join(', ')})`;
      }
    }

    return {
      indexes: Array.from(indexMap.values()),
      primaryKey: primaryKeyColumns,
    };
  }

  /**
   * Get all foreign keys for a specific table
   */
  private async getForeignKeys(tableName: string): Promise<ForeignKey[]> {
    const query = `
      SELECT
        fk.name AS constraint_name,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
        OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column,
        fk.delete_referential_action_desc AS delete_rule,
        fk.update_referential_action_desc AS update_rule,
        fkc.constraint_column_id
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      WHERE fk.parent_object_id = OBJECT_ID(@tableName)
      ORDER BY fk.name, fkc.constraint_column_id;
    `;

    const request = this.pool.request();
    request.input('tableName', sql.VarChar, tableName);
    const result = await request.query(query);

    // Group by constraint name
    const fkMap = new Map<string, ForeignKey>();

    for (const row of result.recordset) {
      const constraintName = row.constraint_name;
      const columnName = row.column_name;
      const referencedTableName = row.referenced_table;
      const referencedColumnName = row.referenced_column;
      const deleteRule = row.delete_rule;
      const updateRule = row.update_rule;

      if (!fkMap.has(constraintName)) {
        fkMap.set(constraintName, {
          name: constraintName,
          columns: [],
          referencedTable: referencedTableName,
          referencedColumns: [],
          onDelete: deleteRule,
          onUpdate: updateRule,
        });
      }

      const fk = fkMap.get(constraintName)!;
      fk.columns.push(columnName);
      fk.referencedColumns.push(referencedColumnName);
    }

    return Array.from(fkMap.values());
  }
}
