import {
  ComparisonResult,
  TableComparison,
  ColumnChange,
  IndexChange,
  ForeignKeyChange,
  Column,
  Index,
  ForeignKey,
} from '../types';

/**
 * Generates SQL migration scripts to make target database match source database
 */
export class MigrationGenerator {
  /**
   * Generate complete migration script
   */
  generate(result: ComparisonResult): string {
    const statements: string[] = [];

    // Add header
    statements.push(this.generateHeader());
    statements.push('');

    // Add summary
    statements.push(this.generateSummary(result));
    statements.push('');

    // Check if there are any changes
    if (result.totalChanges === 0) {
      statements.push('-- No changes detected. Schemas are identical.');
      return statements.join('\n');
    }

    statements.push('-- Migration Steps:');
    statements.push('-- 1. Drop foreign keys (from modified and deleted tables)');
    statements.push('-- 2. Drop tables (tables that exist in target but not in source)');
    statements.push('-- 3. Create tables (tables that exist in source but not in target)');
    statements.push('-- 4. Modify tables (alter columns, indexes)');
    statements.push('-- 5. Add foreign keys (to new and modified tables)');
    statements.push('');
    statements.push('BEGIN;');
    statements.push('');

    // Step 1: Drop foreign keys from modified tables
    statements.push(this.generateDropForeignKeysSection(result));

    // Step 2: Drop tables that are in target but not in source
    statements.push(this.generateDropTablesSection(result));

    // Step 3: Create tables that are in source but not in target
    statements.push(this.generateCreateTablesSection(result));

    // Step 4: Modify existing tables
    statements.push(this.generateAlterTablesSection(result));

    // Step 5: Add foreign keys
    statements.push(this.generateAddForeignKeysSection(result));

    statements.push('COMMIT;');
    statements.push('');
    statements.push('-- Migration script completed');
    statements.push('-- Remember to backup your database before running this script!');

    return statements.join('\n');
  }

  /**
   * Generate script header
   */
  private generateHeader(): string {
    const date = new Date().toISOString();
    return `-- ============================================================================
-- DATABASE MIGRATION SCRIPT
-- Generated: ${date}
-- Purpose: Make target database schema match source database schema
-- ============================================================================
--
-- ⚠️  CRITICAL WARNING: USE AT YOUR OWN RISK ⚠️
--
-- This is an AUTO-GENERATED migration script. It modifies database structure
-- and may cause DATA LOSS or APPLICATION DOWNTIME if not properly tested.
--
-- ============================================================================
-- IMPORTANT CAVEATS AND LIMITATIONS:
-- ============================================================================
--
-- 1. CONSTRAINTS & DEPENDENCIES:
--    ❌ This script does NOT verify foreign key constraint validity
--    ❌ Referenced tables must exist before adding foreign keys
--    ❌ Data in existing columns must satisfy new constraints
--    ❌ Circular dependencies may cause the script to fail
--
-- 2. DATA INTEGRITY RISKS:
--    ⚠️  Dropping columns will PERMANENTLY DELETE data
--    ⚠️  Changing column types may cause data truncation or conversion errors
--    ⚠️  Adding NOT NULL columns to populated tables requires defaults
--    ⚠️  Reducing varchar lengths may truncate existing data
--    ⚠️  Changing numeric precision may lose decimal places
--
-- 3. PERMISSIONS & PRIVILEGES:
--    ❌ This script does NOT handle user permissions
--    ❌ This script does NOT handle role grants
--    ❌ Database user must have DDL privileges (CREATE, ALTER, DROP)
--
-- 4. WHAT IS NOT INCLUDED:
--    ❌ Triggers
--    ❌ Stored procedures and functions
--    ❌ Views
--    ❌ Sequences (except those managed by SERIAL columns)
--    ❌ Partitions
--    ❌ Table inheritance
--    ❌ Check constraints (partial support)
--    ❌ Custom types and domains
--    ❌ Data migration or transformation
--
-- 5. PERFORMANCE CONSIDERATIONS:
--    ⚠️  ALTER TABLE operations may lock tables for extended periods
--    ⚠️  Large tables may take hours to modify
--    ⚠️  Index creation on large tables is resource-intensive
--    ⚠️  Consider maintenance windows for production databases
--
-- 6. TRANSACTION LIMITATIONS:
--    ⚠️  Some DDL operations cannot be rolled back in certain databases
--    ⚠️  MySQL DDL statements cause implicit commits
--    ⚠️  PostgreSQL supports DDL rollback but may leave locks
--
-- ============================================================================
-- MANDATORY SAFETY CHECKLIST BEFORE EXECUTION:
-- ============================================================================
--
-- [ ] 1. BACKUP your entire target database (full backup + verification)
-- [ ] 2. BACKUP your application configuration and code
-- [ ] 3. TEST this script in a NON-PRODUCTION environment with production-like data
-- [ ] 4. VERIFY all constraints will be satisfied by existing data
-- [ ] 5. CHECK that referenced tables exist before adding foreign keys
-- [ ] 6. REVIEW each DROP statement carefully (data loss is irreversible)
-- [ ] 7. SCHEDULE a maintenance window (expect downtime)
-- [ ] 8. STOP all applications and services using the database
-- [ ] 9. ENSURE you have rollback procedures ready
-- [ ] 10. HAVE a database administrator review this script
-- [ ] 11. MONITOR disk space (indexes and data modifications need space)
-- [ ] 12. TEST rollback procedures before applying changes
--
-- ============================================================================
-- RECOMMENDED MIGRATION PROCESS:
-- ============================================================================
--
-- 1. Create a full database backup:
--    PostgreSQL: pg_dump -Fc dbname > backup.dump
--    MySQL:      mysqldump --single-transaction dbname > backup.sql
--
-- 2. Test restore from backup:
--    PostgreSQL: pg_restore -d testdb backup.dump
--    MySQL:      mysql testdb < backup.sql
--
-- 3. Apply migration to TEST environment first
--
-- 4. Run application tests against migrated TEST database
--
-- 5. If tests pass, schedule production maintenance window
--
-- 6. During maintenance window:
--    a. Stop all applications
--    b. Create production backup
--    c. Apply migration
--    d. Verify migration success
--    e. Run smoke tests
--    f. Restart applications
--
-- 7. Monitor application errors and database performance
--
-- ============================================================================
-- DISCLAIMER:
-- ============================================================================
--
-- This script is provided AS-IS without any warranty. The authors and
-- dbcompare tool maintainers are NOT responsible for:
--   - Data loss
--   - Service downtime
--   - Performance degradation
--   - Constraint violations
--   - Any other issues arising from executing this script
--
-- By executing this script, you acknowledge that you have:
--   - Read and understood all warnings and caveats
--   - Performed adequate testing
--   - Created verified backups
--   - Accepted full responsibility for the consequences
--
-- ============================================================================`;
  }

  /**
   * Generate summary section
   */
  private generateSummary(result: ComparisonResult): string {
    const lines: string[] = [];
    lines.push('-- SUMMARY');
    lines.push('-- ----------------------------------------------------------------------------');
    lines.push(`-- Tables to drop:     ${result.addedTables.length}`);
    lines.push(`-- Tables to create:   ${result.deletedTables.length}`);
    lines.push(`-- Tables to modify:   ${result.modifiedTables.length}`);
    lines.push(`-- Total changes:      ${result.totalChanges}`);
    lines.push('-- ----------------------------------------------------------------------------');
    return lines.join('\n');
  }

  /**
   * Generate section to drop foreign keys
   */
  private generateDropForeignKeysSection(result: ComparisonResult): string {
    const statements: string[] = [];
    statements.push('-- ============================================================================');
    statements.push('-- STEP 1: DROP FOREIGN KEYS');
    statements.push('-- ============================================================================');
    statements.push('');

    let hasChanges = false;

    // Drop foreign keys from tables that will be dropped
    for (const table of result.addedTables) {
      if (table.targetTable && table.targetTable.foreignKeys.length > 0) {
        for (const fk of table.targetTable.foreignKeys) {
          statements.push(`-- Drop foreign key from table ${table.tableName}`);
          statements.push(this.generateDropForeignKey(table.tableName, fk.name));
          statements.push('');
          hasChanges = true;
        }
      }
    }

    // Drop modified or deleted foreign keys from modified tables
    for (const table of result.modifiedTables) {
      for (const fkChange of table.foreignKeyChanges) {
        if (fkChange.changeType === 'deleted' || fkChange.changeType === 'modified') {
          statements.push(`-- ${fkChange.changeType === 'deleted' ? 'Drop' : 'Drop (will recreate)'} foreign key ${fkChange.foreignKeyName}`);
          statements.push(this.generateDropForeignKey(table.tableName, fkChange.foreignKeyName));
          statements.push('');
          hasChanges = true;
        }
      }
    }

    if (!hasChanges) {
      statements.push('-- No foreign keys to drop');
      statements.push('');
    }

    return statements.join('\n');
  }

  /**
   * Generate section to drop tables
   */
  private generateDropTablesSection(result: ComparisonResult): string {
    const statements: string[] = [];
    statements.push('-- ============================================================================');
    statements.push('-- STEP 2: DROP TABLES');
    statements.push('-- ============================================================================');
    statements.push('');

    if (result.addedTables.length === 0) {
      statements.push('-- No tables to drop');
      statements.push('');
    } else {
      for (const table of result.addedTables) {
        statements.push(`-- Drop table: ${table.tableName}`);
        statements.push(`DROP TABLE IF EXISTS ${this.quoteIdentifier(table.tableName)} CASCADE;`);
        statements.push('');
      }
    }

    return statements.join('\n');
  }

  /**
   * Generate section to create tables
   */
  private generateCreateTablesSection(result: ComparisonResult): string {
    const statements: string[] = [];
    statements.push('-- ============================================================================');
    statements.push('-- STEP 3: CREATE TABLES');
    statements.push('-- ============================================================================');
    statements.push('');

    if (result.deletedTables.length === 0) {
      statements.push('-- No tables to create');
      statements.push('');
    } else {
      for (const table of result.deletedTables) {
        if (table.sourceTable) {
          statements.push(`-- Create table: ${table.tableName}`);
          statements.push(this.generateCreateTable(table.sourceTable));
          statements.push('');

          // Create indexes (except primary key which is included in CREATE TABLE)
          for (const index of table.sourceTable.indexes) {
            if (!index.isPrimary) {
              statements.push(this.generateCreateIndex(table.tableName, index));
              statements.push('');
            }
          }
        }
      }
    }

    return statements.join('\n');
  }

  /**
   * Generate section to alter tables
   */
  private generateAlterTablesSection(result: ComparisonResult): string {
    const statements: string[] = [];
    statements.push('-- ============================================================================');
    statements.push('-- STEP 4: MODIFY TABLES');
    statements.push('-- ============================================================================');
    statements.push('');

    if (result.modifiedTables.length === 0) {
      statements.push('-- No tables to modify');
      statements.push('');
    } else {
      for (const table of result.modifiedTables) {
        statements.push(`-- Modify table: ${table.tableName}`);
        statements.push('-- ----------------------------------------------------------------------------');
        statements.push('');

        // Handle column changes
        if (table.columnChanges.length > 0) {
          statements.push(`-- Column changes for ${table.tableName}`);
          statements.push(this.generateColumnChanges(table));
          statements.push('');
        }

        // Handle index changes
        if (table.indexChanges.length > 0) {
          statements.push(`-- Index changes for ${table.tableName}`);
          statements.push(this.generateIndexChanges(table));
          statements.push('');
        }
      }
    }

    return statements.join('\n');
  }

  /**
   * Generate section to add foreign keys
   */
  private generateAddForeignKeysSection(result: ComparisonResult): string {
    const statements: string[] = [];
    statements.push('-- ============================================================================');
    statements.push('-- STEP 5: ADD FOREIGN KEYS');
    statements.push('-- ============================================================================');
    statements.push('');

    let hasChanges = false;

    // Add foreign keys to newly created tables
    for (const table of result.deletedTables) {
      if (table.sourceTable && table.sourceTable.foreignKeys.length > 0) {
        for (const fk of table.sourceTable.foreignKeys) {
          statements.push(`-- Add foreign key to table ${table.tableName}`);
          statements.push(this.generateAddForeignKey(table.tableName, fk));
          statements.push('');
          hasChanges = true;
        }
      }
    }

    // Add new or modified foreign keys to modified tables
    for (const table of result.modifiedTables) {
      for (const fkChange of table.foreignKeyChanges) {
        if (fkChange.changeType === 'added' || fkChange.changeType === 'modified') {
          if (fkChange.newValue) {
            statements.push(`-- ${fkChange.changeType === 'added' ? 'Add' : 'Recreate'} foreign key ${fkChange.foreignKeyName}`);
            statements.push(this.generateAddForeignKey(table.tableName, fkChange.newValue));
            statements.push('');
            hasChanges = true;
          }
        }
      }
    }

    if (!hasChanges) {
      statements.push('-- No foreign keys to add');
      statements.push('');
    }

    return statements.join('\n');
  }

  /**
   * Generate CREATE TABLE statement
   */
  private generateCreateTable(table: any): string {
    const lines: string[] = [];
    lines.push(`CREATE TABLE ${this.quoteIdentifier(table.name)} (`);

    const columnDefs: string[] = [];

    // Add column definitions
    for (const column of table.columns) {
      columnDefs.push('  ' + this.generateColumnDefinition(column));
    }

    // Add primary key constraint if it exists
    if (table.primaryKey && table.primaryKey.length > 0) {
      const pkColumns = table.primaryKey.map((col: string) => this.quoteIdentifier(col)).join(', ');
      columnDefs.push(`  PRIMARY KEY (${pkColumns})`);
    }

    lines.push(columnDefs.join(',\n'));
    lines.push(');');

    return lines.join('\n');
  }

  /**
   * Generate column definition
   */
  private generateColumnDefinition(column: Column): string {
    let def = this.quoteIdentifier(column.name) + ' ' + column.type;

    if (!column.nullable) {
      def += ' NOT NULL';
    }

    if (column.defaultValue !== null) {
      def += ' DEFAULT ' + column.defaultValue;
    }

    return def;
  }

  /**
   * Generate column changes for a table
   */
  private generateColumnChanges(table: TableComparison): string {
    const statements: string[] = [];

    for (const change of table.columnChanges) {
      if (change.changeType === 'added' && change.newValue) {
        // Add column
        statements.push(`-- Add column ${change.columnName}`);
        if (!change.newValue.nullable && change.newValue.defaultValue === null) {
          statements.push(
            `-- ⚠️  WARNING: Adding NOT NULL column without default to existing table may fail!`
          );
          statements.push(
            `-- Consider adding a default value or allowing NULL initially, then update and set NOT NULL`
          );
        }
        statements.push(
          `ALTER TABLE ${this.quoteIdentifier(table.tableName)} ADD COLUMN ${this.generateColumnDefinition(change.newValue)};`
        );
      } else if (change.changeType === 'deleted') {
        // Drop column
        statements.push(`-- ⚠️  CRITICAL: Dropping column ${change.columnName} - THIS WILL PERMANENTLY DELETE DATA!`);
        statements.push(`-- Column type was: ${change.oldValue?.type || 'unknown'}`);
        statements.push(`-- Make absolutely sure this column is no longer needed!`);
        statements.push(
          `ALTER TABLE ${this.quoteIdentifier(table.tableName)} DROP COLUMN ${this.quoteIdentifier(change.columnName)};`
        );
      } else if (change.changeType === 'modified' && change.newValue && change.oldValue) {
        // Modify column
        statements.push(`-- Modify column ${change.columnName}`);
        statements.push(this.generateColumnModification(table.tableName, change));
      }
    }

    return statements.join('\n');
  }

  /**
   * Generate column modification statements
   */
  private generateColumnModification(tableName: string, change: ColumnChange): string {
    const statements: string[] = [];
    const oldCol = change.oldValue!;
    const newCol = change.newValue!;

    // Type change
    if (oldCol.type !== newCol.type) {
      statements.push(
        `-- ⚠️  WARNING: Type change may fail if existing data cannot be converted!`
      );
      statements.push(
        `-- Old type: ${oldCol.type} → New type: ${newCol.type}`
      );
      statements.push(
        `ALTER TABLE ${this.quoteIdentifier(tableName)} ALTER COLUMN ${this.quoteIdentifier(change.columnName)} TYPE ${newCol.type};`
      );
    }

    // Nullability change
    if (oldCol.nullable !== newCol.nullable) {
      if (newCol.nullable) {
        statements.push(
          `ALTER TABLE ${this.quoteIdentifier(tableName)} ALTER COLUMN ${this.quoteIdentifier(change.columnName)} DROP NOT NULL;`
        );
      } else {
        statements.push(
          `-- ⚠️  WARNING: Setting NOT NULL will fail if existing rows have NULL values!`
        );
        statements.push(
          `-- Consider: UPDATE ${this.quoteIdentifier(tableName)} SET ${this.quoteIdentifier(change.columnName)} = <default_value> WHERE ${this.quoteIdentifier(change.columnName)} IS NULL;`
        );
        statements.push(
          `ALTER TABLE ${this.quoteIdentifier(tableName)} ALTER COLUMN ${this.quoteIdentifier(change.columnName)} SET NOT NULL;`
        );
      }
    }

    // Default value change
    if (oldCol.defaultValue !== newCol.defaultValue) {
      if (newCol.defaultValue !== null) {
        statements.push(
          `ALTER TABLE ${this.quoteIdentifier(tableName)} ALTER COLUMN ${this.quoteIdentifier(change.columnName)} SET DEFAULT ${newCol.defaultValue};`
        );
      } else {
        statements.push(
          `ALTER TABLE ${this.quoteIdentifier(tableName)} ALTER COLUMN ${this.quoteIdentifier(change.columnName)} DROP DEFAULT;`
        );
      }
    }

    return statements.join('\n');
  }

  /**
   * Generate index changes for a table
   */
  private generateIndexChanges(table: TableComparison): string {
    const statements: string[] = [];

    for (const change of table.indexChanges) {
      if (change.changeType === 'deleted' || change.changeType === 'modified') {
        // Drop index
        if (change.oldValue && !change.oldValue.isPrimary) {
          statements.push(`-- Drop index ${change.indexName}`);
          statements.push(this.generateDropIndex(change.indexName));
        }
      }

      if (change.changeType === 'added' || change.changeType === 'modified') {
        // Create index
        if (change.newValue && !change.newValue.isPrimary) {
          statements.push(`-- ${change.changeType === 'added' ? 'Create' : 'Recreate'} index ${change.indexName}`);
          statements.push(this.generateCreateIndex(table.tableName, change.newValue));
        }
      }
    }

    return statements.join('\n');
  }

  /**
   * Generate CREATE INDEX statement
   */
  private generateCreateIndex(tableName: string, index: Index): string {
    const unique = index.isUnique ? 'UNIQUE ' : '';
    const columns = index.columns.map(col => this.quoteIdentifier(col)).join(', ');
    return `CREATE ${unique}INDEX ${this.quoteIdentifier(index.name)} ON ${this.quoteIdentifier(tableName)} (${columns});`;
  }

  /**
   * Generate DROP INDEX statement
   */
  private generateDropIndex(indexName: string): string {
    return `DROP INDEX IF EXISTS ${this.quoteIdentifier(indexName)};`;
  }

  /**
   * Generate ADD FOREIGN KEY statement
   */
  private generateAddForeignKey(tableName: string, fk: ForeignKey): string {
    const columns = fk.columns.map(col => this.quoteIdentifier(col)).join(', ');
    const refColumns = fk.referencedColumns.map(col => this.quoteIdentifier(col)).join(', ');

    let statement = `ALTER TABLE ${this.quoteIdentifier(tableName)} ADD CONSTRAINT ${this.quoteIdentifier(fk.name)} `;
    statement += `FOREIGN KEY (${columns}) REFERENCES ${this.quoteIdentifier(fk.referencedTable)} (${refColumns})`;

    if (fk.onDelete && fk.onDelete !== 'NO ACTION') {
      statement += ` ON DELETE ${fk.onDelete}`;
    }

    if (fk.onUpdate && fk.onUpdate !== 'NO ACTION') {
      statement += ` ON UPDATE ${fk.onUpdate}`;
    }

    statement += ';';
    return statement;
  }

  /**
   * Generate DROP FOREIGN KEY statement
   */
  private generateDropForeignKey(tableName: string, fkName: string): string {
    return `ALTER TABLE ${this.quoteIdentifier(tableName)} DROP CONSTRAINT IF EXISTS ${this.quoteIdentifier(fkName)};`;
  }

  /**
   * Quote identifier (table/column name)
   */
  private quoteIdentifier(name: string): string {
    return `"${name}"`;
  }
}
