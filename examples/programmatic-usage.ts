/**
 * Example: Using dbcompare programmatically in a TypeScript application
 */

import {
  compareSchemas,
  generateOutput,
  saveToFile,
  ComparisonResult,
  TableComparison,
} from 'dbcompare';

async function analyzeSchemaDifferences(): Promise<void> {
  try {
    console.log('Starting schema comparison...');

    // Define connection strings
    const sourceConnection = 'postgresql://postgres:password@localhost:5432/source_db';
    const targetConnection = 'postgresql://postgres:password@localhost:5432/target_db';

    // Perform the comparison
    const result: ComparisonResult = await compareSchemas(
      sourceConnection,
      targetConnection
    );

    // Display detailed summary
    displaySummary(result);

    // Generate reports
    await generateReports(result);

    // Analyze specific changes
    analyzeChanges(result);

    // Generate migration plan
    generateMigrationPlan(result);

  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
    } else {
      console.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}

function displaySummary(result: ComparisonResult): void {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     Schema Comparison Summary        ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`Source Tables:     ${result.sourceTableCount}`);
  console.log(`Target Tables:     ${result.targetTableCount}`);
  console.log(`Total Differences: ${result.totalChanges}`);
  console.log(`  ✓ Added:         ${result.addedTables.length}`);
  console.log(`  ~ Modified:      ${result.modifiedTables.length}`);
  console.log(`  ✗ Deleted:       ${result.deletedTables.length}`);
}

async function generateReports(result: ComparisonResult): Promise<void> {
  // Generate HTML report
  const htmlReport = generateOutput(result, 'html');
  const htmlPath = `./reports/comparison-${Date.now()}.html`;
  saveToFile(htmlReport, htmlPath);
  console.log(`\n✓ HTML report saved: ${htmlPath}`);

  // Generate text report
  const textReport = generateOutput(result, 'text');
  const textPath = `./reports/comparison-${Date.now()}.txt`;
  saveToFile(textReport, textPath);
  console.log(`✓ Text report saved: ${textPath}`);
}

function analyzeChanges(result: ComparisonResult): void {
  if (result.modifiedTables.length === 0) {
    return;
  }

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║      Modified Tables Analysis        ║');
  console.log('╚════════════════════════════════════════╝');

  result.modifiedTables.forEach((table: TableComparison) => {
    console.log(`\n📊 Table: ${table.tableName}`);

    // Analyze column changes
    if (table.columnChanges.length > 0) {
      console.log(`  Columns:`);
      table.columnChanges.forEach(change => {
        const icon = change.changeType === 'added' ? '✓'
          : change.changeType === 'deleted' ? '✗' : '~';
        console.log(`    ${icon} [${change.changeType.toUpperCase()}] ${change.columnName}`);

        if (change.differences) {
          change.differences.forEach(diff => {
            console.log(`       - ${diff}`);
          });
        }
      });
    }

    // Analyze index changes
    if (table.indexChanges.length > 0) {
      console.log(`  Indexes:`);
      table.indexChanges.forEach(change => {
        const icon = change.changeType === 'added' ? '✓'
          : change.changeType === 'deleted' ? '✗' : '~';
        console.log(`    ${icon} [${change.changeType.toUpperCase()}] ${change.indexName}`);
      });
    }

    // Analyze foreign key changes
    if (table.foreignKeyChanges.length > 0) {
      console.log(`  Foreign Keys:`);
      table.foreignKeyChanges.forEach(change => {
        const icon = change.changeType === 'added' ? '✓'
          : change.changeType === 'deleted' ? '✗' : '~';
        console.log(`    ${icon} [${change.changeType.toUpperCase()}] ${change.foreignKeyName}`);
      });
    }
  });
}

function generateMigrationPlan(result: ComparisonResult): void {
  if (result.totalChanges === 0) {
    console.log('\n✓ No migration needed. Schemas are identical!');
    return;
  }

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║         Migration Plan               ║');
  console.log('╚════════════════════════════════════════╝');

  let step = 1;

  // Step 1: Handle deletions
  if (result.deletedTables.length > 0) {
    console.log(`\n${step++}. Drop tables (⚠️  Data will be lost):`);
    result.deletedTables.forEach(table => {
      console.log(`   DROP TABLE IF EXISTS ${table.tableName};`);
    });
  }

  // Step 2: Create new tables
  if (result.addedTables.length > 0) {
    console.log(`\n${step++}. Create new tables:`);
    result.addedTables.forEach(table => {
      console.log(`   CREATE TABLE ${table.tableName} (...);`);
      console.log(`   -- ${table.targetTable?.columns.length || 0} columns`);
    });
  }

  // Step 3: Alter existing tables
  if (result.modifiedTables.length > 0) {
    console.log(`\n${step++}. Alter existing tables:`);
    result.modifiedTables.forEach(table => {
      const totalChanges =
        table.columnChanges.length +
        table.indexChanges.length +
        table.foreignKeyChanges.length;

      console.log(`   ALTER TABLE ${table.tableName};`);
      console.log(`   -- ${totalChanges} changes required`);

      // Count specific change types
      const added = table.columnChanges.filter(c => c.changeType === 'added').length;
      const modified = table.columnChanges.filter(c => c.changeType === 'modified').length;
      const deleted = table.columnChanges.filter(c => c.changeType === 'deleted').length;

      if (added > 0) console.log(`   -- Add ${added} column(s)`);
      if (modified > 0) console.log(`   -- Modify ${modified} column(s)`);
      if (deleted > 0) console.log(`   -- Drop ${deleted} column(s)`);
    });
  }

  console.log('\n⚠️  Review the changes carefully before applying migrations!');
  console.log('💡 Consider creating a backup before proceeding.');
}

// Run the analysis
analyzeSchemaDifferences();
