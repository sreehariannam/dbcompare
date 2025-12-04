import { ComparisonResult, TableComparison, ColumnChange, IndexChange, ForeignKeyChange } from '../types';

/**
 * Formats comparison results as plain text
 */
export class TextFormatter {
  /**
   * Format comparison result as text
   */
  format(result: ComparisonResult): string {
    const lines: string[] = [];

    // Header
    lines.push('='.repeat(80));
    lines.push('DATABASE SCHEMA COMPARISON REPORT');
    lines.push('='.repeat(80));
    lines.push('');

    // Summary
    lines.push('SUMMARY');
    lines.push('-'.repeat(80));
    lines.push(`Source Tables: ${result.sourceTableCount}`);
    lines.push(`Target Tables: ${result.targetTableCount}`);
    lines.push(`Total Differences: ${result.totalChanges}`);
    lines.push('');
    lines.push(`  Added Tables:    ${result.addedTables.length}`);
    lines.push(`  Modified Tables: ${result.modifiedTables.length}`);
    lines.push(`  Deleted Tables:  ${result.deletedTables.length}`);
    lines.push('');

    // Added Tables
    if (result.addedTables.length > 0) {
      lines.push('='.repeat(80));
      lines.push(`ADDED TABLES (${result.addedTables.length})`);
      lines.push('='.repeat(80));
      lines.push('');

      for (const table of result.addedTables) {
        lines.push(...this.formatAddedTable(table));
      }
    }

    // Modified Tables
    if (result.modifiedTables.length > 0) {
      lines.push('='.repeat(80));
      lines.push(`MODIFIED TABLES (${result.modifiedTables.length})`);
      lines.push('='.repeat(80));
      lines.push('');

      for (const table of result.modifiedTables) {
        lines.push(...this.formatModifiedTable(table));
      }
    }

    // Deleted Tables
    if (result.deletedTables.length > 0) {
      lines.push('='.repeat(80));
      lines.push(`DELETED TABLES (${result.deletedTables.length})`);
      lines.push('='.repeat(80));
      lines.push('');

      for (const table of result.deletedTables) {
        lines.push(...this.formatDeletedTable(table));
      }
    }

    // Footer
    lines.push('='.repeat(80));
    lines.push('END OF REPORT');
    lines.push('='.repeat(80));

    return lines.join('\n');
  }

  /**
   * Format an added table
   */
  private formatAddedTable(table: TableComparison): string[] {
    const lines: string[] = [];

    lines.push(`┌─ TABLE: ${table.tableName} ─ [ADDED]`);
    lines.push('│');
    lines.push(`│ Status: New table added to target database`);
    lines.push('└' + '─'.repeat(78));

    if (table.targetTable) {
      lines.push(`Columns (${table.targetTable.columns.length}):`);
      for (const col of table.targetTable.columns) {
        const nullable = col.nullable ? 'NULL' : 'NOT NULL';
        const defaultVal = col.defaultValue ? ` DEFAULT ${col.defaultValue}` : '';
        lines.push(`  - ${col.name}: ${col.type} ${nullable}${defaultVal}`);
      }

      if (table.targetTable.indexes.length > 0) {
        lines.push('');
        lines.push(`Indexes (${table.targetTable.indexes.length}):`);
        for (const idx of table.targetTable.indexes) {
          const unique = idx.isUnique ? 'UNIQUE ' : '';
          const primary = idx.isPrimary ? 'PRIMARY KEY ' : '';
          const columns = Array.isArray(idx.columns) ? idx.columns.join(', ') : idx.columns;
          lines.push(`  - ${unique}${primary}${idx.name} (${columns})`);
        }
      }

      if (table.targetTable.foreignKeys.length > 0) {
        lines.push('');
        lines.push(`Foreign Keys (${table.targetTable.foreignKeys.length}):`);
        for (const fk of table.targetTable.foreignKeys) {
          const columns = Array.isArray(fk.columns) ? fk.columns.join(', ') : fk.columns;
          const refColumns = Array.isArray(fk.referencedColumns) ? fk.referencedColumns.join(', ') : fk.referencedColumns;
          lines.push(
            `  - ${fk.name}: ${columns} → ${fk.referencedTable}(${refColumns})`
          );
          lines.push(`    ON DELETE ${fk.onDelete}, ON UPDATE ${fk.onUpdate}`);
        }
      }
    }

    lines.push('');
    return lines;
  }

  /**
   * Format a modified table
   */
  private formatModifiedTable(table: TableComparison): string[] {
    const lines: string[] = [];

    // Calculate total changes for this table
    const totalChanges = table.columnChanges.length + table.indexChanges.length + table.foreignKeyChanges.length;

    lines.push('');
    lines.push('┌' + '═'.repeat(78));
    lines.push(`│ TABLE: ${table.tableName} [MODIFIED]`);
    lines.push(`│ Total Changes in this table: ${totalChanges}`);
    lines.push('└' + '─'.repeat(78));
    lines.push('');

    // Column changes
    if (table.columnChanges.length > 0) {
      lines.push(`  ➤ Column Changes (${table.columnChanges.length}):`);
      lines.push('');

      for (const change of table.columnChanges) {
        lines.push(...this.formatColumnChange(change, table.tableName));
      }
    }

    // Index changes
    if (table.indexChanges.length > 0) {
      lines.push(`  ➤ Index Changes (${table.indexChanges.length}):`);
      lines.push('');

      for (const change of table.indexChanges) {
        lines.push(...this.formatIndexChange(change, table.tableName));
      }
    }

    // Foreign key changes
    if (table.foreignKeyChanges.length > 0) {
      lines.push(`  ➤ Foreign Key Changes (${table.foreignKeyChanges.length}):`);
      lines.push('');

      for (const change of table.foreignKeyChanges) {
        lines.push(...this.formatForeignKeyChange(change, table.tableName));
      }
    }

    lines.push('');
    return lines;
  }

  /**
   * Format a deleted table
   */
  private formatDeletedTable(table: TableComparison): string[] {
    const lines: string[] = [];

    lines.push(`┌─ TABLE: ${table.tableName} ─ [DELETED]`);
    lines.push('│');
    lines.push(`│ Status: Table removed from target database`);
    lines.push('└' + '─'.repeat(78));

    if (table.sourceTable) {
      lines.push(`Columns (${table.sourceTable.columns.length}):`);
      for (const col of table.sourceTable.columns) {
        const nullable = col.nullable ? 'NULL' : 'NOT NULL';
        const defaultVal = col.defaultValue ? ` DEFAULT ${col.defaultValue}` : '';
        lines.push(`  - ${col.name}: ${col.type} ${nullable}${defaultVal}`);
      }
    }

    lines.push('');
    return lines;
  }

  /**
   * Format a column change
   */
  private formatColumnChange(change: ColumnChange, tableName?: string): string[] {
    const lines: string[] = [];

    if (change.changeType === 'added') {
      lines.push(`    [+] Column Added: ${change.columnName}`);
      if (change.newValue) {
        const nullable = change.newValue.nullable ? 'NULL' : 'NOT NULL';
        const defaultVal = change.newValue.defaultValue ? ` DEFAULT ${change.newValue.defaultValue}` : '';
        lines.push(`        Type: ${change.newValue.type} ${nullable}${defaultVal}`);
      }
    } else if (change.changeType === 'deleted') {
      lines.push(`    [-] Column Deleted: ${change.columnName}`);
      if (change.oldValue) {
        lines.push(`        Was: ${change.oldValue.type}`);
      }
    } else if (change.changeType === 'modified') {
      lines.push(`    [~] Column Modified: ${change.columnName}`);
      if (change.differences) {
        for (const diff of change.differences) {
          lines.push(`        ${diff}`);
        }
      }
    }

    lines.push('');
    return lines;
  }

  /**
   * Format an index change
   */
  private formatIndexChange(change: IndexChange, tableName?: string): string[] {
    const lines: string[] = [];

    if (change.changeType === 'added') {
      lines.push(`    [+] Index Added: ${change.indexName}`);
      if (change.newValue) {
        const columns = Array.isArray(change.newValue.columns) ? change.newValue.columns.join(', ') : change.newValue.columns;
        lines.push(`        Columns: ${columns}`);
        lines.push(`        Unique: ${change.newValue.isUnique}, Primary: ${change.newValue.isPrimary}`);
      }
    } else if (change.changeType === 'deleted') {
      lines.push(`    [-] Index Deleted: ${change.indexName}`);
    } else if (change.changeType === 'modified') {
      lines.push(`    [~] Index Modified: ${change.indexName}`);
      if (change.oldValue && change.newValue) {
        lines.push(`        Old: ${change.oldValue.definition}`);
        lines.push(`        New: ${change.newValue.definition}`);
      }
    }

    lines.push('');
    return lines;
  }

  /**
   * Format a foreign key change
   */
  private formatForeignKeyChange(change: ForeignKeyChange, tableName?: string): string[] {
    const lines: string[] = [];

    if (change.changeType === 'added') {
      lines.push(`    [+] Foreign Key Added: ${change.foreignKeyName}`);
      if (change.newValue) {
        const columns = Array.isArray(change.newValue.columns) ? change.newValue.columns.join(', ') : change.newValue.columns;
        const refColumns = Array.isArray(change.newValue.referencedColumns) ? change.newValue.referencedColumns.join(', ') : change.newValue.referencedColumns;
        lines.push(
          `        ${columns} → ${change.newValue.referencedTable}(${refColumns})`
        );
      }
    } else if (change.changeType === 'deleted') {
      lines.push(`    [-] Foreign Key Deleted: ${change.foreignKeyName}`);
    } else if (change.changeType === 'modified') {
      lines.push(`    [~] Foreign Key Modified: ${change.foreignKeyName}`);
    }

    lines.push('');
    return lines;
  }
}
