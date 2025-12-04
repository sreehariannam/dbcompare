import inquirer from 'inquirer';
import { DbConnection, DatabaseType, OutputFormat } from '../types';
import chalk from 'chalk';

/**
 * Prompt for database type
 */
async function promptDatabaseType(): Promise<DatabaseType> {
  const { dbType } = await inquirer.prompt<{ dbType: DatabaseType }>([
    {
      type: 'list',
      name: 'dbType',
      message: 'Select database type:',
      choices: [
        { name: 'PostgreSQL', value: 'postgresql' },
        { name: 'MySQL', value: 'mysql' },
      ],
    },
  ]);
  return dbType;
}

/**
 * Prompt for database connection details
 */
async function promptConnectionDetails(
  dbType: DatabaseType,
  label: string
): Promise<DbConnection> {
  console.log(chalk.cyan(`\n${label} Database Connection`));

  const defaultPort = dbType === 'mysql' ? 3306 : 5432;

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'host',
      message: 'Host:',
      default: 'localhost',
    },
    {
      type: 'input',
      name: 'port',
      message: 'Port:',
      default: defaultPort.toString(),
      validate: (input: string) => {
        const port = parseInt(input);
        if (isNaN(port) || port < 1 || port > 65535) {
          return 'Please enter a valid port number (1-65535)';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'database',
      message: 'Database name:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Database name is required';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'user',
      message: 'Username:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Username is required';
        }
        return true;
      },
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password:',
      mask: '*',
    },
  ]);

  return {
    type: dbType,
    host: answers.host,
    port: parseInt(answers.port),
    database: answers.database,
    user: answers.user,
    password: answers.password,
  };
}

/**
 * Prompt for connection mode (URI or manual)
 */
async function promptConnectionMode(): Promise<'uri' | 'manual'> {
  const { mode } = await inquirer.prompt<{ mode: 'uri' | 'manual' }>([
    {
      type: 'list',
      name: 'mode',
      message: 'How would you like to enter connection details?',
      choices: [
        { name: 'Manual entry (step-by-step)', value: 'manual' },
        { name: 'Connection URI', value: 'uri' },
      ],
    },
  ]);
  return mode;
}

/**
 * Prompt for connection URI
 */
async function promptConnectionUri(label: string): Promise<string> {
  const { uri } = await inquirer.prompt<{ uri: string }>([
    {
      type: 'input',
      name: 'uri',
      message: `${label} database connection URI:`,
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Connection URI is required';
        }
        return true;
      },
    },
  ]);
  return uri;
}

/**
 * Prompt for output format and options
 */
async function promptOutputOptions(): Promise<{
  format: OutputFormat;
  outputFile?: string;
  openBrowser?: boolean;
}> {
  const { format } = await inquirer.prompt<{ format: OutputFormat }>([
    {
      type: 'list',
      name: 'format',
      message: 'Select output format:',
      choices: [
        { name: 'Console (display in terminal)', value: 'console' },
        { name: 'Text file', value: 'text' },
        { name: 'HTML file', value: 'html' },
        { name: 'SQL Migration Script', value: 'migration' },
      ],
    },
  ]);

  if (format === 'console') {
    return { format };
  }

  const { outputFile } = await inquirer.prompt<{ outputFile: string }>([
    {
      type: 'input',
      name: 'outputFile',
      message: 'Output file path:',
      default:
        format === 'html'
          ? './schema-comparison.html'
          : format === 'migration'
          ? './schema-migration.sql'
          : './schema-comparison.txt',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Output file path is required';
        }
        return true;
      },
    },
  ]);

  let openBrowser = false;
  if (format === 'html') {
    const { open } = await inquirer.prompt<{ open: boolean }>([
      {
        type: 'confirm',
        name: 'open',
        message: 'Open in browser after generation?',
        default: true,
      },
    ]);
    openBrowser = open;
  }

  return { format, outputFile, openBrowser };
}

/**
 * Run interactive mode
 */
export async function runInteractiveMode(): Promise<{
  sourceConnection: string | DbConnection;
  targetConnection: string | DbConnection;
  outputFormat: OutputFormat;
  outputFile?: string;
  openBrowser?: boolean;
}> {
  console.log(chalk.bold.blue('\n╔═══════════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║   Database Schema Comparison Tool        ║'));
  console.log(chalk.bold.blue('╚═══════════════════════════════════════════╝\n'));

  // Prompt for connection mode
  const mode = await promptConnectionMode();

  let sourceConnection: string | DbConnection;
  let targetConnection: string | DbConnection;

  if (mode === 'uri') {
    // URI mode - for advanced users
    console.log(
      chalk.yellow(
        '\nExample URIs:\n' +
        '  PostgreSQL: postgresql://user:password@localhost:5432/mydb\n' +
        '  MySQL: mysql://user:password@localhost:3306/mydb\n'
      )
    );
    sourceConnection = await promptConnectionUri('Source');
    targetConnection = await promptConnectionUri('Target');
  } else {
    // Manual mode - for non-technical users
    const dbType = await promptDatabaseType();
    sourceConnection = await promptConnectionDetails(dbType, 'Source');
    targetConnection = await promptConnectionDetails(dbType, 'Target');
  }

  // Prompt for output options
  const { format, outputFile, openBrowser } = await promptOutputOptions();

  return {
    sourceConnection,
    targetConnection,
    outputFormat: format,
    outputFile,
    openBrowser,
  };
}
