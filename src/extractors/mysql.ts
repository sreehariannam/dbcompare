import mysql from 'mysql2/promise';
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
 * Extracts schema information from a MySQL database with parallel processing
 */
export class MysqlSchemaExtractor implements SchemaExtractor {
  private pool: mysql.Pool;
  private config: DbConnection;
  private extractionConfig: ExtractionConfig;

  constructor(
    config: DbConnection,
    extractionConfig?: Partial<ExtractionConfig>
  ) {
    this.config = config;

    // Use connection pooling for better performance with large schemas
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      connectionLimit: extractionConfig?.maxConcurrency || 20, // Max 20 concurrent connections
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
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
    // Test connection by running a simple query
    const connection = await this.pool.getConnection();
    try {
      await connection.query('SELECT 1');
    } finally {
      connection.release();
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    await this.pool.end();
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

    // Run queries in parallel, then extract indexes and primary key from same index data
    const [columns, indexRows, foreignKeys] = await Promise.all([
      this.timedQuery('columns', () => this.getColumns(tableName)),
      this.timedQuery('indexes', () => this.getIndexData(tableName)),
      this.timedQuery('foreignKeys', () => this.getForeignKeys(tableName)),
    ]);

    // Extract both indexes and primary key from the same index data (no extra query)
    const { indexes, primaryKey } = this.processIndexData(indexRows);

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
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const [rows] = await this.pool.execute(query, [this.config.database]);
    return (rows as any[]).map((row) => row.table_name || row.TABLE_NAME);
  }

  /**
   * Get all columns for a specific table using SHOW COLUMNS (much faster than information_schema)
   */
  private async getColumns(tableName: string): Promise<Column[]> {
    // Use SHOW COLUMNS which is much faster than querying information_schema
    const query = `SHOW FULL COLUMNS FROM ${this.pool.escapeId(tableName)}`;

    const [rows] = await this.pool.execute(query);

    return (rows as any[]).map((row) => {
      const type = (row.Type || row.TYPE).toLowerCase();
      const nullable = (row.Null || row.NULL) === 'YES';
      const defaultValue = row.Default || row.DEFAULT || null;

      return {
        name: row.Field || row.FIELD,
        type: type,
        nullable: nullable,
        defaultValue: defaultValue,
        characterMaximumLength: this.extractCharLength(type),
        numericPrecision: this.extractNumericPrecision(type),
        numericScale: this.extractNumericScale(type),
      };
    });
  }

  /**
   * Extract character length from type string
   */
  private extractCharLength(type: string): number | null {
    const match = type.match(/(?:var)?char\((\d+)\)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Extract numeric precision from type string
   */
  private extractNumericPrecision(type: string): number | null {
    const match = type.match(/decimal\((\d+)(?:,\d+)?\)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Extract numeric scale from type string
   */
  private extractNumericScale(type: string): number | null {
    const match = type.match(/decimal\(\d+,(\d+)\)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Get raw index data for a specific table using SHOW INDEX (much faster)
   */
  private async getIndexData(tableName: string): Promise<any[]> {
    // Use SHOW INDEX which is much faster than information_schema
    const query = `SHOW INDEX FROM ${this.pool.escapeId(tableName)}`;
    const [rows] = await this.pool.execute(query);
    return rows as any[];
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
      const indexName = row.Key_name || row.KEY_NAME;
      const columnName = row.Column_name || row.COLUMN_NAME;
      const nonUnique = row.Non_unique || row.NON_UNIQUE;
      const seqInIndex = row.Seq_in_index || row.SEQ_IN_INDEX;

      if (!indexMap.has(indexName)) {
        const isPrimary = indexName === 'PRIMARY';
        const isUnique = nonUnique === 0 || nonUnique === '0' || nonUnique === false;

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
      if (indexName === 'PRIMARY') {
        if (!primaryKeyColumns) {
          primaryKeyColumns = [];
        }
        primaryKeyColumns[seqInIndex - 1] = columnName; // Maintain proper order
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
   * Get all foreign keys for a specific table (optimized query)
   */
  private async getForeignKeys(tableName: string): Promise<ForeignKey[]> {
    // Simplified query with only necessary joins
    const query = `
      SELECT
        kcu.CONSTRAINT_NAME,
        kcu.COLUMN_NAME,
        kcu.REFERENCED_TABLE_NAME,
        kcu.REFERENCED_COLUMN_NAME,
        kcu.ORDINAL_POSITION,
        rc.UPDATE_RULE,
        rc.DELETE_RULE
      FROM information_schema.KEY_COLUMN_USAGE kcu
      INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE kcu.TABLE_SCHEMA = ?
        AND kcu.TABLE_NAME = ?
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION;
    `;

    const [rows] = await this.pool.execute(query, [
      this.config.database,
      tableName,
    ]);

    // Group by constraint name
    const fkMap = new Map<string, ForeignKey>();

    for (const row of rows as any[]) {
      const constraintName = row.CONSTRAINT_NAME;
      const columnName = row.COLUMN_NAME;
      const referencedTableName = row.REFERENCED_TABLE_NAME;
      const referencedColumnName = row.REFERENCED_COLUMN_NAME;
      const updateRule = row.UPDATE_RULE;
      const deleteRule = row.DELETE_RULE;

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
