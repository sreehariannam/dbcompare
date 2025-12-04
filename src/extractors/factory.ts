import { DbConnection, SchemaExtractor } from '../types';
import { PostgresSchemaExtractor } from './postgres';
import { MysqlSchemaExtractor } from './mysql';
import { SqlServerSchemaExtractor } from './sqlserver';

/**
 * Creates the appropriate schema extractor based on the database type
 */
export function createExtractor(connection: DbConnection): SchemaExtractor {
  switch (connection.type) {
    case 'postgresql':
      return new PostgresSchemaExtractor(connection);
    case 'mysql':
      return new MysqlSchemaExtractor(connection);
    case 'sqlserver':
      return new SqlServerSchemaExtractor(connection);
    default:
      throw new Error(`Unsupported database type: ${connection.type}`);
  }
}
