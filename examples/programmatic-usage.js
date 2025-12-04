/**
 * Example: Using dbcompare programmatically in a Node.js application
 */

const { compareSchemas, generateOutput, saveToFile } = require('dbcompare');
const fs = require('fs');

async function main() {
  try {
    console.log('Starting schema comparison...');

    // Define connection strings
    const sourceConnection = 'postgresql://postgres:password@localhost:5432/source_db';
    const targetConnection = 'postgresql://postgres:password@localhost:5432/target_db';

    // Perform the comparison
    const result = await compareSchemas(sourceConnection, targetConnection);

    // Display summary
    console.log('\n=== Comparison Summary ===');
    console.log(`Source Tables: ${result.sourceTableCount}`);
    console.log(`Target Tables: ${result.targetTableCount}`);
    console.log(`Total Differences: ${result.totalChanges}`);
    console.log(`  - Added: ${result.addedTables.length}`);
    console.log(`  - Modified: ${result.modifiedTables.length}`);
    console.log(`  - Deleted: ${result.deletedTables.length}`);

    // Generate and save HTML report
    const htmlReport = generateOutput(result, 'html');
    saveToFile(htmlReport, './comparison-report.html');
    console.log('\nHTML report saved to: ./comparison-report.html');

    // Generate and save text report
    const textReport = generateOutput(result, 'text');
    saveToFile(textReport, './comparison-report.txt');
    console.log('Text report saved to: ./comparison-report.txt');

    // Example: Process specific changes
    if (result.modifiedTables.length > 0) {
      console.log('\n=== Modified Tables Details ===');
      result.modifiedTables.forEach(table => {
        console.log(`\nTable: ${table.tableName}`);

        if (table.columnChanges.length > 0) {
          console.log('  Column Changes:');
          table.columnChanges.forEach(change => {
            console.log(`    - [${change.changeType}] ${change.columnName}`);
          });
        }

        if (table.indexChanges.length > 0) {
          console.log('  Index Changes:');
          table.indexChanges.forEach(change => {
            console.log(`    - [${change.changeType}] ${change.indexName}`);
          });
        }

        if (table.foreignKeyChanges.length > 0) {
          console.log('  Foreign Key Changes:');
          table.foreignKeyChanges.forEach(change => {
            console.log(`    - [${change.changeType}] ${change.foreignKeyName}`);
          });
        }
      });
    }

    // Example: Generate migration hints
    if (result.totalChanges > 0) {
      console.log('\n=== Migration Planning ===');

      if (result.deletedTables.length > 0) {
        console.log('⚠️  Warning: Tables will be deleted:');
        result.deletedTables.forEach(table => {
          console.log(`   - ${table.tableName}`);
        });
      }

      if (result.addedTables.length > 0) {
        console.log('✓ New tables to create:');
        result.addedTables.forEach(table => {
          console.log(`   - ${table.tableName}`);
        });
      }

      if (result.modifiedTables.length > 0) {
        console.log('~ Tables requiring alterations:');
        result.modifiedTables.forEach(table => {
          const changes =
            table.columnChanges.length +
            table.indexChanges.length +
            table.foreignKeyChanges.length;
          console.log(`   - ${table.tableName} (${changes} changes)`);
        });
      }
    } else {
      console.log('\n✓ No differences found! Schemas are identical.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
