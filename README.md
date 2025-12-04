# dbcompare

A powerful and intuitive database schema comparison tool for **PostgreSQL and MySQL** databases. Compare schemas between two databases and generate beautiful, detailed reports in text or HTML format.

Website: https://difftree.dev/


## Features

- **🎯 Multi-Database Support**: Works with both PostgreSQL and MySQL databases
- **🎨 Interactive Mode**: User-friendly step-by-step prompts for non-technical users
- **⚡ Advanced CLI Mode**: Powerful command-line interface for developers
- **🚀 Enterprise Scalability**: Handles extremely large databases with up to 100k tables and 200 columns each
- **⚙️ Parallel Processing**: Async/parallel schema extraction using connection pooling for maximum performance
- **📊 Comprehensive Schema Analysis**: Compares tables, columns, indexes, foreign keys, and constraints
- **📄 Multiple Output Formats**: Generate reports in plain text, HTML, or SQL migration scripts
- **🔧 SQL Migration Script Generation**: Automatically generate migration scripts with comprehensive safety warnings
- **🔍 Detailed Change Tracking**: Identifies added, modified, and deleted database objects with clear table context
- **📏 Column-Level Comparison**: Detects changes in data types, nullability, defaults, and more
- **🌐 Browser Integration**: Automatically open HTML reports in your browser
- **🔗 Flexible Connection Strings**: Supports multiple connection string formats (URI, JSON, colon-separated)
- **📈 Professional Reports**: Clean, readable output with summary statistics and prominent table names
- **⚠️ Safety First**: Migration scripts include detailed caveats, risks, and mandatory safety checklists

## Installation

### Global Installation

```bash
npm install -g dbcompare
```

### Local Installation

```bash
npm install dbcompare
```

## Usage

### 🎨 Interactive Mode (Recommended for Beginners)

The easiest way to use dbcompare is with interactive mode. Simply run:

```bash
dbcompare --interactive
```

Or use the short form:

```bash
dbcompare -i
```

You'll be guided through a step-by-step process:
1. Choose connection mode (manual entry or URI)
2. Select database type (PostgreSQL or MySQL)
3. Enter connection details for source and target databases
4. Choose output format (console, text file, or HTML)
5. Review the comparison results

**Perfect for non-technical users** who prefer a guided experience!

### ⚡ CLI Mode (For Advanced Users)

#### Basic Usage

```bash
dbcompare -s <source-connection> -t <target-connection>
```

### Connection String Formats

dbcompare supports multiple connection string formats:

#### 1. Database URI (Recommended)

**PostgreSQL:**
```bash
dbcompare -s "postgresql://user:password@localhost:5432/database1" \
          -t "postgresql://user:password@localhost:5432/database2"
```

**MySQL:**
```bash
dbcompare -s "mysql://user:password@localhost:3306/database1" \
          -t "mysql://user:password@localhost:3306/database2"
```

#### 2. Simple Format (host:port:database:user:password)

```bash
dbcompare -s "localhost:5432:db1:myuser:mypass" \
          -t "localhost:5432:db2:myuser:mypass"
```

#### 3. JSON Format

**PostgreSQL:**
```bash
dbcompare -s '{"type":"postgresql","host":"localhost","port":5432,"database":"db1","user":"myuser","password":"mypass"}' \
          -t '{"type":"postgresql","host":"localhost","port":5432,"database":"db2","user":"myuser","password":"mypass"}'
```

**MySQL:**
```bash
dbcompare -s '{"type":"mysql","host":"localhost","port":3306,"database":"db1","user":"myuser","password":"mypass"}' \
          -t '{"type":"mysql","host":"localhost","port":3306,"database":"db2","user":"myuser","password":"mypass"}'
```

## Command Line Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--interactive` | `-i` | Run in interactive mode (step-by-step prompts) |
| `--source <connection>` | `-s` | Source database connection string |
| `--target <connection>` | `-t` | Target database connection string |
| `--text` | | Output as text file (default) |
| `--html` | | Output as HTML file |
| `--migration` | | Generate SQL migration script |
| `--open` | `-o` | Open HTML report in browser |
| `--output <path>` | | Custom output file path |
| `--console` | | Print to console instead of file |
| `--help` | `-h` | Display help information |
| `--version` | | Display version number |

**Note:** If neither `--source` nor `--target` is provided, the tool automatically enters interactive mode.

## Examples

### Interactive Mode

```bash
# Launch interactive mode
dbcompare -i

# Or just run without arguments
dbcompare
```

### PostgreSQL Examples

#### Generate Text Report (Default)

```bash
dbcompare -s "postgresql://user:pass@localhost:5432/db1" \
          -t "postgresql://user:pass@localhost:5432/db2"
```

Output: `dbcompare-2025-01-15.txt`

#### Generate HTML Report

```bash
dbcompare -s "postgresql://user:pass@localhost:5432/db1" \
          -t "postgresql://user:pass@localhost:5432/db2" \
          --html
```

Output: `dbcompare-2025-01-15.html`

#### Generate and Open HTML Report in Browser

```bash
dbcompare -s "postgresql://user:pass@localhost:5432/db1" \
          -t "postgresql://user:pass@localhost:5432/db2" \
          --html --open
```

#### Compare Databases on Different Hosts

```bash
dbcompare -s "postgresql://user:pass@server1.example.com:5432/production" \
          -t "postgresql://user:pass@server2.example.com:5432/staging" \
          --html -o
```

### MySQL Examples

#### Compare MySQL Databases

```bash
dbcompare -s "mysql://root:password@localhost:3306/db1" \
          -t "mysql://root:password@localhost:3306/db2"
```

#### MySQL with Custom Port

```bash
dbcompare -s "mysql://user:pass@db-server:3307/production" \
          -t "mysql://user:pass@db-server:3307/staging" \
          --html
```

#### MySQL to Console Output

```bash
dbcompare -s "mysql://user:pass@localhost:3306/db1" \
          -t "mysql://user:pass@localhost:3306/db2" \
          --console
```

### Custom Output Path

```bash
dbcompare -s "postgresql://user:pass@localhost:5432/db1" \
          -t "postgresql://user:pass@localhost:5432/db2" \
          --html --output ./reports/schema-comparison.html
```

### Generate SQL Migration Script

```bash
dbcompare -s "postgresql://user:pass@localhost:5432/db1" \
          -t "postgresql://user:pass@localhost:5432/db2" \
          --migration
```

Output: `dbcompare-2025-01-15.sql`

The migration script will contain SQL statements to make the target database match the source database schema, including:
- CREATE TABLE statements for tables in source but not in target
- DROP TABLE statements for tables in target but not in source
- ALTER TABLE statements for modified columns
- CREATE/DROP INDEX statements for index changes
- ADD/DROP FOREIGN KEY statements for foreign key constraints

**IMPORTANT**: Always review and test migration scripts before running them on production databases!
## What Gets Compared?

### Tables
- Added tables (exist in target but not in source)
- Deleted tables (exist in source but not in target)
- Modified tables (exist in both but with differences)

### Columns
- Added, deleted, or modified columns
- Data type changes
- Nullability changes
- Default value changes
- Character length changes
- Numeric precision and scale changes

### Indexes
- Added, deleted, or modified indexes
- Unique constraints
- Primary keys
- Index definitions

### Foreign Keys
- Added, deleted, or modified foreign key constraints
- Referenced tables and columns
- ON DELETE and ON UPDATE rules

## Report Format

### Summary Section

The report begins with a summary showing:
- Total number of tables in source and target
- Total number of differences found
- Breakdown by change type (added, modified, deleted)

### Detailed Changes

For each changed table, the report shows:
- Table name
- Type of change (added/modified/deleted)
- Detailed list of column changes
- Index changes
- Foreign key changes

### Change Types

- `[+]` Added - New object in target database
- `[~]` Modified - Object exists in both but has differences
- `[-]` Deleted - Object exists in source but not in target

## Sample Output

### Text Format

```
================================================================================
DATABASE SCHEMA COMPARISON REPORT
================================================================================

SUMMARY
--------------------------------------------------------------------------------
Source Tables: 15
Target Tables: 17
Total Differences: 5

  Added Tables:    2
  Modified Tables: 3
  Deleted Tables:  0

================================================================================
MODIFIED TABLES (3)
================================================================================

┌══════════════════════════════════════════════════════════════════════════════
│ TABLE: users [MODIFIED]
│ Total Changes in this table: 3
└──────────────────────────────────────────────────────────────────────────────

  ➤ Column Changes (2):

    [+] Column Added: last_login
        Type: timestamp NULL

    [~] Column Modified: email
        Type changed: varchar(100) → varchar(255)

  ➤ Index Changes (1):

    [+] Index Added: idx_users_last_login
        Columns: last_login
        Unique: false, Primary: false
```

**Note:** The new format clearly shows which table each change belongs to with prominent table headers and change counts.

### HTML Format

The HTML report features:
- Modern, responsive design
- Color-coded change indicators
- Collapsible sections
- Summary dashboard with statistics
- Professional styling
- Print-friendly layout

## Programmatic Usage

You can also use dbcompare as a library in your Node.js applications:

```javascript
import { compareSchemas, generateOutput } from 'dbcompare';

async function compareMyDatabases() {
  const result = await compareSchemas(
    'postgresql://user:pass@localhost:5432/db1',
    'postgresql://user:pass@localhost:5432/db2'
  );

  // Generate HTML report
  const htmlReport = generateOutput(result, 'html');

  // Generate migration script
  const migrationScript = generateOutput(result, 'migration');

  // Access comparison data
  console.log(`Found ${result.totalChanges} differences`);
  console.log(`Added tables: ${result.addedTables.length}`);
  console.log(`Modified tables: ${result.modifiedTables.length}`);
  console.log(`Deleted tables: ${result.deletedTables.length}`);
}
```

## Requirements

- Node.js 14.0.0 or higher
- PostgreSQL and/or MySQL database access
- Network connectivity to both source and target databases
- Appropriate database permissions (read access to schema information)

## Scalability for Large Databases

dbcompare is designed to handle extremely large database schemas efficiently:

- **✅ Supports databases with 100,000+ tables**
- **✅ Handles tables with 200+ columns**
- **✅ Uses connection pooling for optimal performance**
- **✅ Processes tables in parallel (configurable concurrency)**
- **✅ Batch processing to manage memory efficiently**
- **✅ Real-time progress reporting for long operations**

### Performance Example

For a database with 100,000 tables:
- **Sequential processing**: ~28 hours
- **Parallel processing (20 concurrent)**: ~1-2 hours
- **Memory usage**: Constant per batch (configurable)

### Configuration

Advanced users can configure performance parameters:

```javascript
import { PostgresSchemaExtractor } from 'dbcompare';

const extractor = new PostgresSchemaExtractor(connection, {
  batchSize: 200,      // Tables per batch (default: 100)
  maxConcurrency: 30   // Parallel operations (default: 20)
});
```

**📖 For detailed scaling information, tuning guidelines, and troubleshooting, see [SCALING.md](./SCALING.md)**

## Troubleshooting

### Connection Errors

**Error: Connection refused**
- Ensure your database server is running
- Check if the port is correct (PostgreSQL default: 5432, MySQL default: 3306)
- Verify firewall settings

**Error: Authentication failed (PostgreSQL)**
- Verify username and password
- Check if user has necessary permissions
- Ensure the user can connect from your host

**Error: ER_ACCESS_DENIED (MySQL)**
- Verify MySQL username and password
- Check if user has necessary permissions
- Ensure the user has access from your host (check MySQL user's host field)

**Error: Database does not exist**
- Confirm the database name is correct
- Check if the database exists on the server

### Permission Issues

**PostgreSQL:**
The user must have at least the following permissions:
- `CONNECT` on the database
- `SELECT` on `information_schema` views
- `SELECT` on system catalogs (`pg_*` tables)

**MySQL:**
The user must have at least the following permissions:
- `SELECT` on `information_schema` database
- Access to the specific database you want to compare

### Output Issues

**Report file not created**
- Check write permissions in the output directory
- Ensure sufficient disk space
- Verify the output path is valid

## License

This project is licensed under the Business Source License 1.1 (BUSL-1.1).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions:
- GitHub Issues: [Report a bug or request a feature]
- Documentation: See this README and `--help` output

## Migration Script Safety

When using the `--migration` option, dbcompare generates SQL DDL statements to synchronize the target database with the source database. The generated script includes:

1. **Transaction Wrapper**: All changes are wrapped in a `BEGIN...COMMIT` transaction
2. **Dependency Handling**: Operations are ordered correctly (drop FKs first, add them last)
3. **Safety Comments**: Clear documentation of what each section does
4. **Warnings**: Prominent reminders to backup and test before applying

**Best Practices**:
- Always backup your database before running migration scripts
- Test migration scripts in a non-production environment first
- Review the generated SQL carefully
- Ensure no applications are actively using the database during migration
- Consider running the migration during a maintenance window

**Future Enhancements:**
- Support for additional databases (MariaDB, SQL Server, Oracle, etc.)
- Ignore patterns and filters
- Diff-only mode (show only differences)
- JSON output format
- Configuration file support
- Performance optimizations for large schemas
- Table/column filtering options
- Comparison history tracking
- Rollback script generation
- Data migration support

---

Made with ❤️ for database administrators and developers
