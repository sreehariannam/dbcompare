/**
 * Supported database types
 */
export type DatabaseType = 'postgresql' | 'mysql' | 'sqlserver';

/**
 * Database connection configuration
 */
export interface DbConnection {
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

/**
 * Column definition in a table
 */
export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  characterMaximumLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
}

/**
 * Index definition
 */
export interface Index {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  definition: string;
}

/**
 * Foreign key constraint
 */
export interface ForeignKey {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete: string;
  onUpdate: string;
}

/**
 * Table schema definition
 */
export interface TableSchema {
  name: string;
  columns: Column[];
  indexes: Index[];
  foreignKeys: ForeignKey[];
  primaryKey: string[] | null;
}

/**
 * Complete database schema
 */
export interface DatabaseSchema {
  tables: Map<string, TableSchema>;
}

/**
 * Types of changes detected in comparison
 */
export type ChangeType = 'added' | 'modified' | 'deleted';

/**
 * Column-level change details
 */
export interface ColumnChange {
  columnName: string;
  changeType: ChangeType;
  oldValue?: Column;
  newValue?: Column;
  differences?: string[];
}

/**
 * Index-level change details
 */
export interface IndexChange {
  indexName: string;
  changeType: ChangeType;
  oldValue?: Index;
  newValue?: Index;
}

/**
 * Foreign key change details
 */
export interface ForeignKeyChange {
  foreignKeyName: string;
  changeType: ChangeType;
  oldValue?: ForeignKey;
  newValue?: ForeignKey;
}

/**
 * Table-level comparison result
 */
export interface TableComparison {
  tableName: string;
  changeType: ChangeType;
  columnChanges: ColumnChange[];
  indexChanges: IndexChange[];
  foreignKeyChanges: ForeignKeyChange[];
  sourceTable?: TableSchema;
  targetTable?: TableSchema;
}

/**
 * Complete comparison result
 */
export interface ComparisonResult {
  sourceTableCount: number;
  targetTableCount: number;
  addedTables: TableComparison[];
  modifiedTables: TableComparison[];
  deletedTables: TableComparison[];
  totalChanges: number;
}

/**
 * Output format options
 */
export type OutputFormat = 'text' | 'html' | 'console' | 'migration';

/**
 * CLI options
 */
export interface CliOptions {
  source?: string;
  target?: string;
  output?: OutputFormat;
  openBrowser?: boolean;
  outputFile?: string;
  interactive?: boolean;
}

/**
 * Interface for database schema extractors
 */
export interface SchemaExtractor {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  extractSchema(): Promise<DatabaseSchema>;
}
