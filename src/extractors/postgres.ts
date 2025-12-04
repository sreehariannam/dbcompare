import { Pool, PoolClient } from 'pg';
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
 * Extracts schema information from a PostgreSQL database with parallel processing
 */
export class PostgresSchemaExtractor implements SchemaExtractor {
  private pool: Pool;
  private config: ExtractionConfig;

  constructor(
    private connection: DbConnection,
    config?: Partial<ExtractionConfig>
  ) {
    // Use connection pooling for better performance with large schemas
    this.pool = new Pool({
      host: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.user,
      password: connection.password,
      max: config?.maxConcurrency || 20, // Max 20 concurrent connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Default configuration optimized for large databases
    this.config = {
      batchSize: config?.batchSize || 100,           // Process 100 tables per batch
      maxConcurrency: config?.maxConcurrency || 20,  // 20 parallel operations
    };
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    // Test connection by running a simple query
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
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
    const batches = this.createBatches(tables, this.config.batchSize);

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
      const elapsed = ((Date.now() - Date.now()) / 1000 / 60).toFixed(1);
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
    for (let i = 0; i < Math.min(this.config.maxConcurrency, tableNames.length); i++) {
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
    // Run all queries for this table in parallel
    const [columns, indexes, foreignKeys, primaryKey] = await Promise.all([
      this.getColumns(tableName),
      this.getIndexes(tableName),
      this.getForeignKeys(tableName),
      this.getPrimaryKey(tableName),
    ]);

    return {
      name: tableName,
      columns,
      indexes,
      foreignKeys,
      primaryKey,
    };
  }

  /**
   * Get list of all tables in the database
   */
  private async getTables(): Promise<string[]> {
    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const result = await this.pool.query(query);
    return result.rows.map((row) => row.table_name);
  }

  /**
   * Get all columns for a specific table
   */
  private async getColumns(tableName: string): Promise<Column[]> {
    const query = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position;
    `;

    const result = await this.pool.query(query, [tableName]);

    return result.rows.map((row) => ({
      name: row.column_name,
      type: this.getFullDataType(row),
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default,
      characterMaximumLength: row.character_maximum_length,
      numericPrecision: row.numeric_precision,
      numericScale: row.numeric_scale,
    }));
  }

  /**
   * Get full data type including precision/length
   */
  private getFullDataType(row: any): string {
    let type = row.data_type;

    if (type === 'USER-DEFINED') {
      type = row.udt_name;
    } else if (type === 'character varying' && row.character_maximum_length) {
      type = `varchar(${row.character_maximum_length})`;
    } else if (type === 'character' && row.character_maximum_length) {
      type = `char(${row.character_maximum_length})`;
    } else if (type === 'numeric' && row.numeric_precision) {
      if (row.numeric_scale) {
        type = `numeric(${row.numeric_precision},${row.numeric_scale})`;
      } else {
        type = `numeric(${row.numeric_precision})`;
      }
    }

    return type;
  }

  /**
   * Get all indexes for a specific table
   */
  private async getIndexes(tableName: string): Promise<Index[]> {
    const query = `
      SELECT
        i.indexname as index_name,
        i.indexdef as index_definition,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary,
        array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns
      FROM pg_indexes i
      JOIN pg_class c ON c.relname = i.tablename
      JOIN pg_index ix ON ix.indexrelid = (
        SELECT oid FROM pg_class WHERE relname = i.indexname
      )
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(ix.indkey)
      WHERE i.schemaname = 'public'
        AND i.tablename = $1
      GROUP BY i.indexname, i.indexdef, ix.indisunique, ix.indisprimary
      ORDER BY i.indexname;
    `;

    const result = await this.pool.query(query, [tableName]);

    return result.rows.map((row) => {
      // Ensure columns is always a proper JavaScript array
      let columns = row.columns;
      if (typeof columns === 'string') {
        // Parse PostgreSQL array format: "{col1,col2}" -> ["col1", "col2"]
        columns = columns.replace(/^\{|\}$/g, '').split(',');
      } else if (!Array.isArray(columns)) {
        columns = [columns];
      }

      return {
        name: row.index_name,
        columns: columns,
        isUnique: row.is_unique,
        isPrimary: row.is_primary,
        definition: row.index_definition,
      };
    });
  }

  /**
   * Get all foreign keys for a specific table
   */
  private async getForeignKeys(tableName: string): Promise<ForeignKey[]> {
    const query = `
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
      ORDER BY tc.constraint_name, kcu.ordinal_position;
    `;

    const result = await this.pool.query(query, [tableName]);

    // Group by constraint name since a FK can span multiple columns
    const fkMap = new Map<string, ForeignKey>();

    for (const row of result.rows) {
      const fkName = row.constraint_name;

      if (!fkMap.has(fkName)) {
        fkMap.set(fkName, {
          name: fkName,
          columns: [],
          referencedTable: row.foreign_table_name,
          referencedColumns: [],
          onDelete: row.delete_rule,
          onUpdate: row.update_rule,
        });
      }

      const fk = fkMap.get(fkName)!;
      fk.columns.push(row.column_name);
      fk.referencedColumns.push(row.foreign_column_name);
    }

    return Array.from(fkMap.values());
  }

  /**
   * Get primary key columns for a specific table
   */
  private async getPrimaryKey(tableName: string): Promise<string[] | null> {
    const query = `
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass
        AND i.indisprimary
      ORDER BY array_position(i.indkey, a.attnum);
    `;

    const result = await this.pool.query(query, [tableName]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows.map((row) => row.attname);
  }
}
