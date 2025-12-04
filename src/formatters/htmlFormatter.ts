import { ComparisonResult, TableComparison, ColumnChange, IndexChange, ForeignKeyChange } from '../types';

/**
 * Formats comparison results as HTML
 */
export class HtmlFormatter {
  /**
   * Format comparison result as HTML
   */
  format(result: ComparisonResult): string {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Schema Comparison Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }

        .header h1 {
            font-size: 2em;
            margin-bottom: 10px;
        }

        .header p {
            opacity: 0.9;
        }

        .summary {
            padding: 30px;
            background: #f8f9fa;
            border-bottom: 2px solid #e9ecef;
        }

        .summary h2 {
            color: #495057;
            margin-bottom: 20px;
            font-size: 1.5em;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #667eea;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .stat-label {
            font-size: 0.85em;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #212529;
            margin-top: 5px;
        }

        .changes-summary {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
        }

        .change-card {
            padding: 15px;
            border-radius: 6px;
            text-align: center;
        }

        .change-card.added {
            background: #d4edda;
            border: 1px solid #c3e6cb;
        }

        .change-card.modified {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
        }

        .change-card.deleted {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
        }

        .change-number {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .change-card.added .change-number {
            color: #155724;
        }

        .change-card.modified .change-number {
            color: #856404;
        }

        .change-card.deleted .change-number {
            color: #721c24;
        }

        .change-label {
            font-size: 0.9em;
            color: #495057;
        }

        .content {
            padding: 30px;
        }

        .section {
            margin-bottom: 40px;
        }

        .section-header {
            background: #495057;
            color: white;
            padding: 15px 20px;
            border-radius: 6px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .section-header h2 {
            font-size: 1.3em;
        }

        .badge {
            background: rgba(255,255,255,0.2);
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
        }

        .table-card {
            background: #fff;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            margin-bottom: 20px;
            overflow: hidden;
        }

        .table-header {
            background: #f8f9fa;
            padding: 15px 20px;
            border-bottom: 2px solid #dee2e6;
            font-weight: bold;
            font-size: 1.1em;
            color: #495057;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .table-header .table-name {
            font-size: 1.2em;
            color: #212529;
        }

        .table-header .change-count {
            background: #667eea;
            color: white;
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.85em;
            font-weight: normal;
        }

        .table-body {
            padding: 20px;
        }

        .change-item {
            padding: 12px;
            margin-bottom: 10px;
            border-radius: 4px;
            border-left: 4px solid;
        }

        .change-item.added {
            background: #d4edda;
            border-color: #28a745;
        }

        .change-item.modified {
            background: #fff3cd;
            border-color: #ffc107;
        }

        .change-item.deleted {
            background: #f8d7da;
            border-color: #dc3545;
        }

        .change-title {
            font-weight: bold;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
        }

        .change-icon {
            display: inline-block;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            text-align: center;
            line-height: 20px;
            margin-right: 10px;
            font-size: 0.8em;
            color: white;
        }

        .change-icon.added {
            background: #28a745;
        }

        .change-icon.modified {
            background: #ffc107;
        }

        .change-icon.deleted {
            background: #dc3545;
        }

        .change-details {
            margin-left: 30px;
            font-size: 0.9em;
            color: #495057;
        }

        .change-details ul {
            list-style: none;
            padding-left: 0;
        }

        .change-details li {
            padding: 3px 0;
        }

        .subsection {
            margin-top: 20px;
        }

        .subsection-title {
            font-weight: bold;
            color: #495057;
            margin-bottom: 10px;
            font-size: 1em;
        }

        .column-list, .index-list, .fk-list {
            list-style: none;
            padding-left: 0;
        }

        .column-list li, .index-list li, .fk-list li {
            padding: 8px 12px;
            background: #f8f9fa;
            margin-bottom: 5px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }

        .column-name, .index-name, .fk-name {
            font-weight: bold;
            color: #667eea;
        }

        .type-info {
            color: #6c757d;
        }

        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            border-top: 2px solid #e9ecef;
        }

        @media print {
            body {
                background: white;
            }
            .container {
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Database Schema Comparison Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>

        ${this.renderSummary(result)}
        ${this.renderContent(result)}

        <div class="footer">
            <p>Generated by dbcompare - Database Schema Comparison Tool</p>
        </div>
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * Render summary section
   */
  private renderSummary(result: ComparisonResult): string {
    return `
        <div class="summary">
            <h2>Summary</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Source Tables</div>
                    <div class="stat-value">${result.sourceTableCount}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Target Tables</div>
                    <div class="stat-value">${result.targetTableCount}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Differences</div>
                    <div class="stat-value">${result.totalChanges}</div>
                </div>
            </div>

            <div class="changes-summary">
                <div class="change-card added">
                    <div class="change-number">${result.addedTables.length}</div>
                    <div class="change-label">Added Tables</div>
                </div>
                <div class="change-card modified">
                    <div class="change-number">${result.modifiedTables.length}</div>
                    <div class="change-label">Modified Tables</div>
                </div>
                <div class="change-card deleted">
                    <div class="change-number">${result.deletedTables.length}</div>
                    <div class="change-label">Deleted Tables</div>
                </div>
            </div>
        </div>`;
  }

  /**
   * Render main content
   */
  private renderContent(result: ComparisonResult): string {
    let content = '<div class="content">';

    if (result.addedTables.length > 0) {
      content += this.renderSection('Added Tables', result.addedTables, 'added');
    }

    if (result.modifiedTables.length > 0) {
      content += this.renderSection('Modified Tables', result.modifiedTables, 'modified');
    }

    if (result.deletedTables.length > 0) {
      content += this.renderSection('Deleted Tables', result.deletedTables, 'deleted');
    }

    content += '</div>';
    return content;
  }

  /**
   * Render a section (added, modified, or deleted tables)
   */
  private renderSection(title: string, tables: TableComparison[], type: string): string {
    let section = `
        <div class="section">
            <div class="section-header">
                <h2>${title}</h2>
                <span class="badge">${tables.length} table${tables.length !== 1 ? 's' : ''}</span>
            </div>`;

    for (const table of tables) {
      if (type === 'added') {
        section += this.renderAddedTable(table);
      } else if (type === 'modified') {
        section += this.renderModifiedTable(table);
      } else if (type === 'deleted') {
        section += this.renderDeletedTable(table);
      }
    }

    section += '</div>';
    return section;
  }

  /**
   * Render an added table
   */
  private renderAddedTable(table: TableComparison): string {
    let html = `
        <div class="table-card">
            <div class="table-header">
                <span class="table-name">✅ TABLE: ${this.escapeHtml(table.tableName)}</span>
                <span class="change-count" style="background: #28a745;">NEW</span>
            </div>
            <div class="table-body">`;

    if (table.targetTable) {
      html += `
                <div class="subsection">
                    <div class="subsection-title">Columns (${table.targetTable.columns.length})</div>
                    <ul class="column-list">`;

      for (const col of table.targetTable.columns) {
        const nullable = col.nullable ? 'NULL' : 'NOT NULL';
        const defaultVal = col.defaultValue ? ` DEFAULT ${this.escapeHtml(col.defaultValue)}` : '';
        html += `
                        <li>
                            <span class="column-name">${this.escapeHtml(col.name)}</span>
                            <span class="type-info">${this.escapeHtml(col.type)} ${nullable}${defaultVal}</span>
                        </li>`;
      }

      html += `
                    </ul>
                </div>`;

      if (table.targetTable.indexes.length > 0) {
        html += `
                <div class="subsection">
                    <div class="subsection-title">Indexes (${table.targetTable.indexes.length})</div>
                    <ul class="index-list">`;

        for (const idx of table.targetTable.indexes) {
          const unique = idx.isUnique ? 'UNIQUE ' : '';
          const primary = idx.isPrimary ? 'PRIMARY KEY ' : '';
          html += `
                        <li>
                            ${unique}${primary}<span class="index-name">${this.escapeHtml(idx.name)}</span>
                            (${idx.columns.map(c => this.escapeHtml(c)).join(', ')})
                        </li>`;
        }

        html += `
                    </ul>
                </div>`;
      }

      if (table.targetTable.foreignKeys.length > 0) {
        html += `
                <div class="subsection">
                    <div class="subsection-title">Foreign Keys (${table.targetTable.foreignKeys.length})</div>
                    <ul class="fk-list">`;

        for (const fk of table.targetTable.foreignKeys) {
          html += `
                        <li>
                            <span class="fk-name">${this.escapeHtml(fk.name)}</span>:
                            ${fk.columns.map(c => this.escapeHtml(c)).join(', ')} →
                            ${this.escapeHtml(fk.referencedTable)}(${fk.referencedColumns.map(c => this.escapeHtml(c)).join(', ')})
                        </li>`;
        }

        html += `
                    </ul>
                </div>`;
      }
    }

    html += `
            </div>
        </div>`;

    return html;
  }

  /**
   * Render a modified table
   */
  private renderModifiedTable(table: TableComparison): string {
    const totalChanges = table.columnChanges.length + table.indexChanges.length + table.foreignKeyChanges.length;

    let html = `
        <div class="table-card">
            <div class="table-header">
                <span class="table-name">📋 TABLE: ${this.escapeHtml(table.tableName)}</span>
                <span class="change-count">${totalChanges} change${totalChanges !== 1 ? 's' : ''}</span>
            </div>
            <div class="table-body">`;

    if (table.columnChanges.length > 0) {
      html += `<div class="subsection-title">Column Changes (${table.columnChanges.length})</div>`;
      for (const change of table.columnChanges) {
        html += this.renderColumnChange(change);
      }
    }

    if (table.indexChanges.length > 0) {
      html += `<div class="subsection-title">Index Changes (${table.indexChanges.length})</div>`;
      for (const change of table.indexChanges) {
        html += this.renderIndexChange(change);
      }
    }

    if (table.foreignKeyChanges.length > 0) {
      html += `<div class="subsection-title">Foreign Key Changes (${table.foreignKeyChanges.length})</div>`;
      for (const change of table.foreignKeyChanges) {
        html += this.renderForeignKeyChange(change);
      }
    }

    html += `
            </div>
        </div>`;

    return html;
  }

  /**
   * Render a deleted table
   */
  private renderDeletedTable(table: TableComparison): string {
    let html = `
        <div class="table-card">
            <div class="table-header">
                <span class="table-name">🗑️ TABLE: ${this.escapeHtml(table.tableName)}</span>
                <span class="change-count" style="background: #dc3545;">DELETED</span>
            </div>
            <div class="table-body">`;

    if (table.sourceTable) {
      html += `
                <div class="subsection">
                    <div class="subsection-title">Columns (${table.sourceTable.columns.length})</div>
                    <ul class="column-list">`;

      for (const col of table.sourceTable.columns) {
        const nullable = col.nullable ? 'NULL' : 'NOT NULL';
        html += `
                        <li>
                            <span class="column-name">${this.escapeHtml(col.name)}</span>
                            <span class="type-info">${this.escapeHtml(col.type)} ${nullable}</span>
                        </li>`;
      }

      html += `
                    </ul>
                </div>`;
    }

    html += `
            </div>
        </div>`;

    return html;
  }

  /**
   * Render a column change
   */
  private renderColumnChange(change: ColumnChange): string {
    let html = `
        <div class="change-item ${change.changeType}">
            <div class="change-title">
                <span class="change-icon ${change.changeType}">${this.getChangeIcon(change.changeType)}</span>
                ${this.escapeHtml(change.columnName)}
            </div>`;

    if (change.changeType === 'added' && change.newValue) {
      const nullable = change.newValue.nullable ? 'NULL' : 'NOT NULL';
      const defaultVal = change.newValue.defaultValue ? ` DEFAULT ${this.escapeHtml(change.newValue.defaultValue)}` : '';
      html += `
            <div class="change-details">
                Type: ${this.escapeHtml(change.newValue.type)} ${nullable}${defaultVal}
            </div>`;
    } else if (change.changeType === 'deleted' && change.oldValue) {
      html += `
            <div class="change-details">
                Was: ${this.escapeHtml(change.oldValue.type)}
            </div>`;
    } else if (change.changeType === 'modified' && change.differences) {
      html += `
            <div class="change-details">
                <ul>`;
      for (const diff of change.differences) {
        html += `<li>${this.escapeHtml(diff)}</li>`;
      }
      html += `
                </ul>
            </div>`;
    }

    html += `
        </div>`;

    return html;
  }

  /**
   * Render an index change
   */
  private renderIndexChange(change: IndexChange): string {
    let html = `
        <div class="change-item ${change.changeType}">
            <div class="change-title">
                <span class="change-icon ${change.changeType}">${this.getChangeIcon(change.changeType)}</span>
                ${this.escapeHtml(change.indexName)}
            </div>`;

    if (change.changeType === 'added' && change.newValue) {
      html += `
            <div class="change-details">
                Columns: ${change.newValue.columns.map(c => this.escapeHtml(c)).join(', ')}<br>
                Unique: ${change.newValue.isUnique}, Primary: ${change.newValue.isPrimary}
            </div>`;
    }

    html += `
        </div>`;

    return html;
  }

  /**
   * Render a foreign key change
   */
  private renderForeignKeyChange(change: ForeignKeyChange): string {
    let html = `
        <div class="change-item ${change.changeType}">
            <div class="change-title">
                <span class="change-icon ${change.changeType}">${this.getChangeIcon(change.changeType)}</span>
                ${this.escapeHtml(change.foreignKeyName)}
            </div>`;

    if (change.changeType === 'added' && change.newValue) {
      html += `
            <div class="change-details">
                ${change.newValue.columns.map(c => this.escapeHtml(c)).join(', ')} →
                ${this.escapeHtml(change.newValue.referencedTable)}(${change.newValue.referencedColumns.map(c => this.escapeHtml(c)).join(', ')})
            </div>`;
    }

    html += `
        </div>`;

    return html;
  }

  /**
   * Get icon for change type
   */
  private getChangeIcon(changeType: string): string {
    switch (changeType) {
      case 'added':
        return '+';
      case 'modified':
        return '~';
      case 'deleted':
        return '-';
      default:
        return '';
    }
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
