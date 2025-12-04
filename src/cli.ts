#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import open from 'open';
import * as fs from 'fs';
import * as path from 'path';
import { compareSchemas, generateOutput, saveToFile } from './index';
import { runInteractiveMode } from './modes/interactive';

const program = new Command();

program
  .name('dbcompare')
  .description('Compare PostgreSQL and MySQL database schemas and generate detailed comparison reports')
  .version('1.0.0');

program
  .option('-s, --source <connection>', 'Source database connection string')
  .option('-t, --target <connection>', 'Target database connection string')
  .option('-i, --interactive', 'Run in interactive mode (step-by-step prompts)')
  .option('--text', 'Output as text file (default)')
  .option('--html', 'Output as HTML file')
  .option('--migration', 'Generate SQL migration script')
  .option('-o, --open', 'Open HTML report in browser')
  .option('--output <path>', 'Custom output file path')
  .option('--console', 'Print to console instead of file')
  .helpOption('-h, --help', 'Display help information')
  .addHelpText('after', `
Examples:
  # Interactive mode (recommended for beginners)
  $ dbcompare --interactive
  $ dbcompare -i

  # Using PostgreSQL URI format
  $ dbcompare -s "postgresql://user:pass@localhost:5432/db1" -t "postgresql://user:pass@localhost:5432/db2"

  # Using MySQL URI format
  $ dbcompare -s "mysql://user:pass@localhost:3306/db1" -t "mysql://user:pass@localhost:3306/db2"

  # Using simplified format (host:port:database:user:password)
  $ dbcompare -s "localhost:5432:db1:user:pass" -t "localhost:5432:db2:user:pass"

  # Using JSON format with MySQL
  $ dbcompare -s '{"type":"mysql","host":"localhost","port":3306,"database":"db1","user":"user","password":"pass"}' \\
              -t '{"type":"mysql","host":"localhost","port":3306,"database":"db2","user":"user","password":"pass"}'

  # Generate HTML report and open in browser
  $ dbcompare -s <source> -t <target> --html -o

  # Output to console
  $ dbcompare -s <source> -t <target> --console

  # Generate SQL migration script
  $ dbcompare -s <source> -t <target> --migration

  # Custom output file
  $ dbcompare -s <source> -t <target> --html --output ./reports/comparison.html

Connection String Formats:
  1. PostgreSQL URI: postgresql://user:password@host:port/database
  2. MySQL URI:      mysql://user:password@host:port/database
  3. Simple format:  host:port:database:user:password
  4. JSON format:    {"type":"mysql","host":"...","port":3306,"database":"...","user":"...","password":"..."}
`);

program.parse();

const options = program.opts();

// Main execution
async function main() {
  try {
    let sourceConnection: string | any;
    let targetConnection: string | any;
    let outputFormat: 'text' | 'html' | 'console' | 'migration' = 'text';
    let outputFile: string | undefined;
    let openBrowser: boolean = false;

    // Check if interactive mode is requested or no arguments provided
    if (options.interactive || (!options.source && !options.target)) {
      // Run interactive mode
      const interactiveResult = await runInteractiveMode();
      sourceConnection = interactiveResult.sourceConnection;
      targetConnection = interactiveResult.targetConnection;
      outputFormat = interactiveResult.outputFormat;
      outputFile = interactiveResult.outputFile;
      openBrowser = interactiveResult.openBrowser || false;
    } else {
      // Validate required options for CLI mode
      if (!options.source || !options.target) {
        console.error(chalk.red('Error: Both --source and --target options are required'));
        console.log('\nUse --help for usage information, or run with --interactive flag');
        process.exit(1);
      }

      sourceConnection = options.source;
      targetConnection = options.target;

      // Determine output format
      if (options.migration) {
        outputFormat = 'migration';
      } else if (options.html) {
        outputFormat = 'html';
      } else if (options.console) {
        outputFormat = 'console';
      } else {
        outputFormat = 'text';
      }

      outputFile = options.output;
      openBrowser = options.open || false;
    }

    console.log(chalk.blue('\n🔍 Starting database schema comparison...'));
    console.log(chalk.gray('Source: Connecting...'));
    console.log(chalk.gray('Target: Connecting...'));

    // Perform comparison
    const result = await compareSchemas(sourceConnection, targetConnection);

    console.log(chalk.green('✓ Schema extraction completed'));
    console.log(chalk.blue('📊 Analyzing differences...'));

    // Determine output format and generate content
    let format: 'text' | 'html' | 'migration' = 'text';

    if (options.interactive || (!options.source && !options.target)) {
      // Interactive mode - use the format from interactive prompt
      format = outputFormat === 'console' ? 'text' : (outputFormat as 'text' | 'html' | 'migration');
    } else {
      // CLI mode - determine from options
      if (options.migration) {
        format = 'migration';
      } else if (options.html) {
        format = 'html';
      } else {
        format = 'text';
      }
    }

    const content = generateOutput(result, format);

    // Display summary
    console.log('\n' + chalk.bold('═'.repeat(60)));
    console.log(chalk.bold.cyan('  COMPARISON SUMMARY'));
    console.log(chalk.bold('═'.repeat(60)));
    console.log(chalk.white(`  Source Tables:     ${result.sourceTableCount}`));
    console.log(chalk.white(`  Target Tables:     ${result.targetTableCount}`));
    console.log(chalk.white(`  Total Differences: ${result.totalChanges}`));
    console.log('');
    console.log(chalk.green(`  ✓ Added Tables:    ${result.addedTables.length}`));
    console.log(chalk.yellow(`  ~ Modified Tables: ${result.modifiedTables.length}`));
    console.log(chalk.red(`  ✗ Deleted Tables:  ${result.deletedTables.length}`));
    console.log(chalk.bold('═'.repeat(60)) + '\n');

    // Handle output
    if (outputFormat === 'console') {
      // Print to console
      console.log(content);
    } else {
      // Determine output file path
      let outputPath: string;

      if (outputFile) {
        outputPath = outputFile;
      } else {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        let extension = 'txt';
        if (format === 'html') {
          extension = 'html';
        } else if (format === 'migration') {
          extension = 'sql';
        }
        outputPath = path.join(process.cwd(), `dbcompare-${timestamp}.${extension}`);
      }

      // Save to file
      saveToFile(content, outputPath);
      console.log(chalk.green(`✓ Report saved to: ${outputPath}`));

      // Open in browser if requested
      if (openBrowser && format === 'html') {
        console.log(chalk.blue('🌐 Opening report in browser...'));
        await open(outputPath);
      }
    }

    // Provide migration hints if there are differences
    if (result.totalChanges > 0) {
      if (format === 'migration') {
        console.log(chalk.yellow('\n⚠️  IMPORTANT: Review the migration script carefully before running it!'));
        console.log(chalk.yellow('   - Backup your database before applying migrations'));
        console.log(chalk.yellow('   - Test in a non-production environment first'));
        console.log(chalk.yellow('   - Ensure no applications are using the database during migration'));
      } else {
        console.log(chalk.yellow('\n💡 Tip: Use --migration to generate a SQL migration script.'));
      }
    } else {
      console.log(chalk.green('\n✨ No differences found. Schemas are identical!'));
    }

  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));

      // Provide helpful hints for common errors
      if (error.message.includes('connection')) {
        console.log(chalk.yellow('\n💡 Connection Tips:'));
        console.log(chalk.gray('  - Ensure the database server is running'));
        console.log(chalk.gray('  - Verify the connection string format'));
        console.log(chalk.gray('  - Check username and password'));
        console.log(chalk.gray('  - Confirm network connectivity'));
      } else if (error.message.includes('ECONNREFUSED')) {
        console.log(chalk.yellow('\n💡 Connection refused. Is your database server running?'));
      } else if (error.message.includes('authentication')) {
        console.log(chalk.yellow('\n💡 Authentication failed. Check your credentials.'));
      } else if (error.message.includes('ER_ACCESS_DENIED')) {
        console.log(chalk.yellow('\n💡 MySQL access denied. Check your username and password.'));
      }
    } else {
      console.error(chalk.red('\n❌ An unexpected error occurred'));
    }

    process.exit(1);
  }
}

// Run the CLI
main();
