import { DbConnection, DatabaseType } from '../types';

/**
 * Parse a database connection string
 * Supports formats:
 * - postgresql://user:password@host:port/database
 * - postgres://user:password@host:port/database
 * - mysql://user:password@host:port/database
 * - sqlserver://user:password@host:port/database
 * - mssql://user:password@host:port/database
 * - host:port:database:user:password (colon-separated format)
 * - JSON: {"type":"mysql","host":"localhost","port":3306,"database":"mydb","user":"user","password":"pass"}
 */
export function parseConnectionString(connectionString: string): DbConnection {
  // Try JSON format first
  if (connectionString.trim().startsWith('{')) {
    try {
      const config = JSON.parse(connectionString);
      const dbType: DatabaseType = config.type || 'postgresql';
      let defaultPort = 5432; // PostgreSQL default
      if (dbType === 'mysql') defaultPort = 3306;
      if (dbType === 'sqlserver') defaultPort = 1433;

      return {
        type: dbType,
        host: config.host || 'localhost',
        port: config.port || defaultPort,
        database: config.database,
        user: config.user,
        password: config.password,
      };
    } catch (error) {
      throw new Error('Invalid JSON connection string');
    }
  }

  // Try URI format (PostgreSQL, MySQL, or SQL Server)
  if (
    connectionString.startsWith('postgresql://') ||
    connectionString.startsWith('postgres://') ||
    connectionString.startsWith('mysql://') ||
    connectionString.startsWith('sqlserver://') ||
    connectionString.startsWith('mssql://')
  ) {
    try {
      const url = new URL(connectionString);
      let dbType: DatabaseType = 'postgresql';
      let defaultPort = 5432;

      if (connectionString.startsWith('mysql://')) {
        dbType = 'mysql';
        defaultPort = 3306;
      } else if (connectionString.startsWith('sqlserver://') || connectionString.startsWith('mssql://')) {
        dbType = 'sqlserver';
        defaultPort = 1433;
      }

      return {
        type: dbType,
        host: url.hostname || 'localhost',
        port: url.port ? parseInt(url.port) : defaultPort,
        database: url.pathname.slice(1), // Remove leading slash
        user: url.username,
        password: url.password,
      };
    } catch (error) {
      throw new Error(`Invalid database connection URI`);
    }
  }

  // Try colon-separated format (host:port:database:user:password)
  // Defaults to PostgreSQL for backward compatibility
  const parts = connectionString.split(':');
  if (parts.length === 5) {
    return {
      type: 'postgresql',
      host: parts[0] || 'localhost',
      port: parseInt(parts[1]) || 5432,
      database: parts[2],
      user: parts[3],
      password: parts[4],
    };
  }

  throw new Error(
    'Invalid connection string format. Supported formats:\n' +
    '  - postgresql://user:password@host:port/database\n' +
    '  - mysql://user:password@host:port/database\n' +
    '  - sqlserver://user:password@host:port/database (or mssql://)\n' +
    '  - host:port:database:user:password\n' +
    '  - {"type":"sqlserver","host":"localhost","port":1433,"database":"mydb","user":"user","password":"pass"}'
  );
}

/**
 * Validate a database connection configuration
 */
export function validateConnection(connection: DbConnection): void {
  if (!connection.type) {
    throw new Error('Database type is required');
  }

  if (connection.type !== 'postgresql' && connection.type !== 'mysql' && connection.type !== 'sqlserver') {
    throw new Error('Database type must be either "postgresql", "mysql", or "sqlserver"');
  }

  if (!connection.host) {
    throw new Error('Database host is required');
  }

  if (!connection.port || connection.port < 1 || connection.port > 65535) {
    throw new Error('Invalid database port');
  }

  if (!connection.database) {
    throw new Error('Database name is required');
  }

  if (!connection.user) {
    throw new Error('Database user is required');
  }

  if (!connection.password) {
    throw new Error('Database password is required');
  }
}
