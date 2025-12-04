import { createExtractor } from './extractors/factory';
import { SchemaComparator } from './comparators/schemaComparator';
import { TextFormatter } from './formatters/textFormatter';
import { HtmlFormatter } from './formatters/htmlFormatter';
import { MigrationGenerator } from './generators/migrationGenerator';
import { parseConnectionString, validateConnection } from './utils/connectionParser';
import { DbConnection, ComparisonResult, OutputFormat } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Main comparison function
 */
export async function compareSchemas(
  sourceConnectionString: string | DbConnection,
  targetConnectionString: string | DbConnection
): Promise<ComparisonResult> {
  // Parse connection strings or use provided DbConnection objects
  const sourceConnection =
    typeof sourceConnectionString === 'string'
      ? parseConnectionString(sourceConnectionString)
      : sourceConnectionString;

  const targetConnection =
    typeof targetConnectionString === 'string'
      ? parseConnectionString(targetConnectionString)
      : targetConnectionString;

  // Validate connections
  validateConnection(sourceConnection);
  validateConnection(targetConnection);

  // Ensure both databases are of the same type
  if (sourceConnection.type !== targetConnection.type) {
    throw new Error(
      `Cannot compare different database types: ${sourceConnection.type} vs ${targetConnection.type}`
    );
  }

  // Extract schemas
  const sourceExtractor = createExtractor(sourceConnection);
  const targetExtractor = createExtractor(targetConnection);

  try {
    await sourceExtractor.connect();
    await targetExtractor.connect();

    const sourceSchema = await sourceExtractor.extractSchema();
    const targetSchema = await targetExtractor.extractSchema();

    // Compare schemas
    const comparator = new SchemaComparator();
    const result = comparator.compare(sourceSchema, targetSchema);

    return result;
  } finally {
    await sourceExtractor.disconnect();
    await targetExtractor.disconnect();
  }
}

/**
 * Generate output in specified format
 */
export function generateOutput(
  result: ComparisonResult,
  format: OutputFormat
): string {
  if (format === 'html') {
    const formatter = new HtmlFormatter();
    return formatter.format(result);
  } else if (format === 'migration') {
    const generator = new MigrationGenerator();
    return generator.generate(result);
  } else {
    const formatter = new TextFormatter();
    return formatter.format(result);
  }
}

/**
 * Save output to file
 */
export function saveToFile(content: string, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, content, 'utf-8');
}

// Export types
export * from './types';
