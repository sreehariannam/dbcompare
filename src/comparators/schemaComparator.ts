import {
  DatabaseSchema,
  TableSchema,
  Column,
  Index,
  ForeignKey,
  ComparisonResult,
  TableComparison,
  ColumnChange,
  IndexChange,
  ForeignKeyChange,
  ChangeType,
} from '../types';

/**
 * Compares two database schemas and generates a detailed comparison report
 */
export class SchemaComparator {
  /**
   * Compare two database schemas
   */
  compare(
    sourceSchema: DatabaseSchema,
    targetSchema: DatabaseSchema
  ): ComparisonResult {
    const addedTables: TableComparison[] = [];
    const modifiedTables: TableComparison[] = [];
    const deletedTables: TableComparison[] = [];

    const sourceTables = new Set(sourceSchema.tables.keys());
    const targetTables = new Set(targetSchema.tables.keys());

    // Find added tables (in target but not in source)
    for (const tableName of targetTables) {
      if (!sourceTables.has(tableName)) {
        addedTables.push({
          tableName,
          changeType: 'added',
          columnChanges: [],
          indexChanges: [],
          foreignKeyChanges: [],
          targetTable: targetSchema.tables.get(tableName)!,
        });
      }
    }

    // Find deleted tables (in source but not in target)
    for (const tableName of sourceTables) {
      if (!targetTables.has(tableName)) {
        deletedTables.push({
          tableName,
          changeType: 'deleted',
          columnChanges: [],
          indexChanges: [],
          foreignKeyChanges: [],
          sourceTable: sourceSchema.tables.get(tableName)!,
        });
      }
    }

    // Find modified tables (in both source and target)
    for (const tableName of sourceTables) {
      if (targetTables.has(tableName)) {
        const sourceTable = sourceSchema.tables.get(tableName)!;
        const targetTable = targetSchema.tables.get(tableName)!;

        const tableComparison = this.compareTables(
          sourceTable,
          targetTable
        );

        // Only add to modified tables if there are actual changes
        if (
          tableComparison.columnChanges.length > 0 ||
          tableComparison.indexChanges.length > 0 ||
          tableComparison.foreignKeyChanges.length > 0
        ) {
          modifiedTables.push(tableComparison);
        }
      }
    }

    return {
      sourceTableCount: sourceTables.size,
      targetTableCount: targetTables.size,
      addedTables,
      modifiedTables,
      deletedTables,
      totalChanges:
        addedTables.length + modifiedTables.length + deletedTables.length,
    };
  }

  /**
   * Compare two tables and find differences
   */
  private compareTables(
    sourceTable: TableSchema,
    targetTable: TableSchema
  ): TableComparison {
    const columnChanges = this.compareColumns(
      sourceTable.columns,
      targetTable.columns
    );
    const indexChanges = this.compareIndexes(
      sourceTable.indexes,
      targetTable.indexes
    );
    const foreignKeyChanges = this.compareForeignKeys(
      sourceTable.foreignKeys,
      targetTable.foreignKeys
    );

    return {
      tableName: sourceTable.name,
      changeType: 'modified',
      columnChanges,
      indexChanges,
      foreignKeyChanges,
      sourceTable,
      targetTable,
    };
  }

  /**
   * Compare columns between two tables
   */
  private compareColumns(
    sourceColumns: Column[],
    targetColumns: Column[]
  ): ColumnChange[] {
    const changes: ColumnChange[] = [];

    const sourceColMap = new Map(
      sourceColumns.map((col) => [col.name, col])
    );
    const targetColMap = new Map(
      targetColumns.map((col) => [col.name, col])
    );

    // Find added columns
    for (const [colName, targetCol] of targetColMap) {
      if (!sourceColMap.has(colName)) {
        changes.push({
          columnName: colName,
          changeType: 'added',
          newValue: targetCol,
        });
      }
    }

    // Find deleted columns
    for (const [colName, sourceCol] of sourceColMap) {
      if (!targetColMap.has(colName)) {
        changes.push({
          columnName: colName,
          changeType: 'deleted',
          oldValue: sourceCol,
        });
      }
    }

    // Find modified columns
    for (const [colName, sourceCol] of sourceColMap) {
      const targetCol = targetColMap.get(colName);
      if (targetCol) {
        const differences = this.getColumnDifferences(sourceCol, targetCol);
        if (differences.length > 0) {
          changes.push({
            columnName: colName,
            changeType: 'modified',
            oldValue: sourceCol,
            newValue: targetCol,
            differences,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Get specific differences between two columns
   */
  private getColumnDifferences(
    sourceCol: Column,
    targetCol: Column
  ): string[] {
    const differences: string[] = [];

    if (sourceCol.type !== targetCol.type) {
      differences.push(
        `Type changed: ${sourceCol.type} → ${targetCol.type}`
      );
    }

    if (sourceCol.nullable !== targetCol.nullable) {
      differences.push(
        `Nullable changed: ${sourceCol.nullable} → ${targetCol.nullable}`
      );
    }

    if (sourceCol.defaultValue !== targetCol.defaultValue) {
      differences.push(
        `Default value changed: ${sourceCol.defaultValue ?? 'NULL'} → ${targetCol.defaultValue ?? 'NULL'}`
      );
    }

    if (
      sourceCol.characterMaximumLength !== targetCol.characterMaximumLength
    ) {
      differences.push(
        `Max length changed: ${sourceCol.characterMaximumLength ?? 'N/A'} → ${targetCol.characterMaximumLength ?? 'N/A'}`
      );
    }

    if (sourceCol.numericPrecision !== targetCol.numericPrecision) {
      differences.push(
        `Precision changed: ${sourceCol.numericPrecision ?? 'N/A'} → ${targetCol.numericPrecision ?? 'N/A'}`
      );
    }

    if (sourceCol.numericScale !== targetCol.numericScale) {
      differences.push(
        `Scale changed: ${sourceCol.numericScale ?? 'N/A'} → ${targetCol.numericScale ?? 'N/A'}`
      );
    }

    return differences;
  }

  /**
   * Compare indexes between two tables
   */
  private compareIndexes(
    sourceIndexes: Index[],
    targetIndexes: Index[]
  ): IndexChange[] {
    const changes: IndexChange[] = [];

    const sourceIdxMap = new Map(
      sourceIndexes.map((idx) => [idx.name, idx])
    );
    const targetIdxMap = new Map(
      targetIndexes.map((idx) => [idx.name, idx])
    );

    // Find added indexes
    for (const [idxName, targetIdx] of targetIdxMap) {
      if (!sourceIdxMap.has(idxName)) {
        changes.push({
          indexName: idxName,
          changeType: 'added',
          newValue: targetIdx,
        });
      }
    }

    // Find deleted indexes
    for (const [idxName, sourceIdx] of sourceIdxMap) {
      if (!targetIdxMap.has(idxName)) {
        changes.push({
          indexName: idxName,
          changeType: 'deleted',
          oldValue: sourceIdx,
        });
      }
    }

    // Find modified indexes (comparing definitions)
    for (const [idxName, sourceIdx] of sourceIdxMap) {
      const targetIdx = targetIdxMap.get(idxName);
      if (targetIdx && sourceIdx.definition !== targetIdx.definition) {
        changes.push({
          indexName: idxName,
          changeType: 'modified',
          oldValue: sourceIdx,
          newValue: targetIdx,
        });
      }
    }

    return changes;
  }

  /**
   * Compare foreign keys between two tables
   */
  private compareForeignKeys(
    sourceFKs: ForeignKey[],
    targetFKs: ForeignKey[]
  ): ForeignKeyChange[] {
    const changes: ForeignKeyChange[] = [];

    const sourceFKMap = new Map(sourceFKs.map((fk) => [fk.name, fk]));
    const targetFKMap = new Map(targetFKs.map((fk) => [fk.name, fk]));

    // Find added foreign keys
    for (const [fkName, targetFK] of targetFKMap) {
      if (!sourceFKMap.has(fkName)) {
        changes.push({
          foreignKeyName: fkName,
          changeType: 'added',
          newValue: targetFK,
        });
      }
    }

    // Find deleted foreign keys
    for (const [fkName, sourceFK] of sourceFKMap) {
      if (!targetFKMap.has(fkName)) {
        changes.push({
          foreignKeyName: fkName,
          changeType: 'deleted',
          oldValue: sourceFK,
        });
      }
    }

    // Find modified foreign keys
    for (const [fkName, sourceFK] of sourceFKMap) {
      const targetFK = targetFKMap.get(fkName);
      if (targetFK && !this.areForeignKeysEqual(sourceFK, targetFK)) {
        changes.push({
          foreignKeyName: fkName,
          changeType: 'modified',
          oldValue: sourceFK,
          newValue: targetFK,
        });
      }
    }

    return changes;
  }

  /**
   * Check if two foreign keys are equal
   */
  private areForeignKeysEqual(fk1: ForeignKey, fk2: ForeignKey): boolean {
    return (
      fk1.referencedTable === fk2.referencedTable &&
      fk1.onDelete === fk2.onDelete &&
      fk1.onUpdate === fk2.onUpdate &&
      JSON.stringify(fk1.columns) === JSON.stringify(fk2.columns) &&
      JSON.stringify(fk1.referencedColumns) ===
        JSON.stringify(fk2.referencedColumns)
    );
  }
}
