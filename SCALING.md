# Scaling to Large Databases

This document describes the architectural improvements made to scale dbcompare for extremely large databases (up to 100k tables with 200 columns each).

## Overview

The dbcompare tool has been optimized to handle massive database schemas through:

1. **Connection Pooling**: Efficient connection reuse for both PostgreSQL and MySQL
2. **Parallel Processing**: Concurrent extraction of table schemas
3. **Batch Processing**: Memory-efficient processing of large table sets
4. **Progress Reporting**: Real-time feedback for long-running operations
5. **Comprehensive Migration Warnings**: Detailed caveats about risks and constraints

## Architecture Improvements

### 1. Connection Pooling

Both PostgreSQL and MySQL extractors now use connection pooling instead of single connections:

#### PostgreSQL
- Uses `pg.Pool` with configurable connection limits
- Default: 20 concurrent connections
- Automatic connection recycling
- Configurable idle and connection timeouts

#### MySQL
- Uses `mysql2` connection pooling
- Default: 20 concurrent connections
- Queue management for connection requests
- Keep-alive enabled for long-running operations

### 2. Parallel Processing

Tables are processed in parallel within configurable batch sizes:

```typescript
// Example: Processing 100 tables per batch with 20 parallel operations
const extractor = new PostgresSchemaExtractor(connection, {
  batchSize: 100,
  maxConcurrency: 20
});
```

**How it works:**
1. Fetch list of all tables
2. Divide tables into batches (default: 100 tables per batch)
3. Within each batch, process tables in parallel (default: 20 concurrent operations)
4. For each table, fetch columns, indexes, foreign keys, and primary keys in parallel
5. Report progress after each batch

### 3. Performance Characteristics

For a database with 100,000 tables:

- **Without parallelization**: ~28 hours (1 second per table)
- **With parallel processing (20 concurrent)**: ~1.4 hours (assuming 1 second per table, 20x speedup)
- **Actual performance**: Will be faster as multiple queries per table run in parallel

Memory usage remains constant per batch, preventing memory exhaustion on large schemas.

### 4. Configuration Options

Both `PostgresSchemaExtractor` and `MysqlSchemaExtractor` accept optional configuration:

```typescript
interface ExtractionConfig {
  batchSize: number;      // Number of tables to process in each batch (default: 100)
  maxConcurrency: number; // Maximum concurrent table extractions (default: 20)
}
```

**Tuning Recommendations:**

| Database Size | batchSize | maxConcurrency | Notes |
|--------------|-----------|----------------|-------|
| < 100 tables | 50 | 10 | Low overhead |
| 100-1,000 tables | 100 | 20 | Balanced |
| 1,000-10,000 tables | 100 | 20 | Default config |
| 10,000-100,000 tables | 200 | 30 | High throughput |
| > 100,000 tables | 500 | 50 | Maximum performance |

**Important:** Higher concurrency requires more database connections. Ensure your database server can handle the connection load.

### 5. Progress Reporting

Real-time progress reporting shows:
- Current batch being processed
- Number of tables in the batch
- Overall progress percentage
- Tables processed vs. total tables

Example output:
```
Extracting schema for 100000 tables...
Processing batch 1/1000 (100 tables)...
Progress: 10% (10000/100000 tables processed)
Processing batch 2/1000 (100 tables)...
Progress: 20% (20000/100000 tables processed)
...
Schema extraction completed.
```

## Migration Script Caveats

The migration script generator now includes comprehensive warnings about:

### Critical Warnings
- **Data Loss Risks**: Dropping columns permanently deletes data
- **Constraint Violations**: Operations may fail if data doesn't satisfy new constraints
- **Type Conversions**: Data may be truncated or conversion may fail
- **NULL Constraints**: Adding NOT NULL to populated tables requires all values to be non-null

### What's NOT Included
- Triggers
- Stored procedures and functions
- Views
- Sequences (except SERIAL)
- Partitions
- Table inheritance
- Check constraints
- Custom types
- Data migration

### Safety Checklist
The migration script includes a mandatory checklist:
- [ ] Backup entire database
- [ ] Test in non-production environment
- [ ] Verify constraints will be satisfied
- [ ] Review all DROP statements
- [ ] Schedule maintenance window
- [ ] Stop all applications
- [ ] Prepare rollback procedures
- [ ] Monitor disk space
- And more...

### Inline Warnings
Risky operations include inline warnings:

```sql
-- ⚠️  CRITICAL: Dropping column user_email - THIS WILL PERMANENTLY DELETE DATA!
-- Column type was: varchar(255)
-- Make absolutely sure this column is no longer needed!
ALTER TABLE "users" DROP COLUMN "user_email";

-- ⚠️  WARNING: Type change may fail if existing data cannot be converted!
-- Old type: varchar(50) → New type: varchar(20)
ALTER TABLE "products" ALTER COLUMN "code" TYPE varchar(20);

-- ⚠️  WARNING: Setting NOT NULL will fail if existing rows have NULL values!
-- Consider: UPDATE "orders" SET "customer_id" = <default_value> WHERE "customer_id" IS NULL;
ALTER TABLE "orders" ALTER COLUMN "customer_id" SET NOT NULL;
```

## Performance Best Practices

1. **Run during off-peak hours**: Schema extraction can be resource-intensive
2. **Monitor database load**: Adjust concurrency if database is under heavy load
3. **Use read replicas**: Extract from replicas when possible to avoid impacting production
4. **Optimize network**: Ensure low-latency connection between tool and database
5. **Increase pool size carefully**: More connections = more database resources
6. **Test on smaller schemas first**: Validate configuration before running on production

## Example Usage

```typescript
import { PostgresSchemaExtractor, MysqlSchemaExtractor } from 'dbcompare';

// For PostgreSQL with custom configuration
const pgExtractor = new PostgresSchemaExtractor(
  {
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: 'huge_db',
    user: 'dbuser',
    password: 'password'
  },
  {
    batchSize: 200,      // Process 200 tables per batch
    maxConcurrency: 30   // Up to 30 parallel operations
  }
);

// For MySQL with custom configuration
const mysqlExtractor = new MysqlSchemaExtractor(
  {
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    database: 'huge_db',
    user: 'dbuser',
    password: 'password'
  },
  {
    batchSize: 200,
    maxConcurrency: 30
  }
);

await pgExtractor.connect();
const schema = await pgExtractor.extractSchema();
await pgExtractor.disconnect();
```

## Troubleshooting

### Issue: "Too many connections" error

**Solution:** Reduce `maxConcurrency` or increase database `max_connections` setting.

For PostgreSQL:
```sql
-- Check current setting
SHOW max_connections;

-- Increase in postgresql.conf
max_connections = 200
```

For MySQL:
```sql
-- Check current setting
SHOW VARIABLES LIKE 'max_connections';

-- Increase in my.cnf
max_connections = 200
```

### Issue: Out of memory errors

**Solution:** Reduce `batchSize` to process fewer tables at once.

### Issue: Slow performance despite parallelization

**Possible causes:**
1. Network latency between tool and database
2. Database server resource constraints (CPU, memory, disk I/O)
3. Slow queries due to missing indexes on information_schema
4. Database under heavy load from other operations

**Solutions:**
- Run from same network/region as database
- Increase database resources
- Run during off-peak hours
- Use read replicas

### Issue: Connection timeout errors

**Solution:** Increase connection timeout in extractor configuration:

```typescript
// Modify the pool configuration in the extractor constructor
this.pool = new Pool({
  // ... other config
  connectionTimeoutMillis: 30000, // Increase from 10000
  idleTimeoutMillis: 60000        // Increase from 30000
});
```

## Technical Details

### Query Parallelization per Table

For each table, four queries run in parallel:
1. Columns query (`information_schema.columns`)
2. Indexes query (`pg_indexes` or `information_schema.STATISTICS`)
3. Foreign keys query (`information_schema.table_constraints` + joins)
4. Primary key query (`pg_index` or `information_schema.KEY_COLUMN_USAGE`)

This 4x parallelization per table significantly improves performance.

### Memory Management

Memory usage is bounded by batch size:
- Each table schema is stored in memory
- After processing a batch, results are added to the main map
- Garbage collection can reclaim temporary objects between batches
- Peak memory ≈ `batchSize * avgColumnsPerTable * sizeof(Column)`

For 100 tables with 200 columns each:
- Peak memory per batch ≈ 100 * 200 * 500 bytes ≈ 10 MB
- Very manageable even for large schemas

## Future Enhancements

Potential improvements for even larger scales:

1. **Streaming results**: Write results to disk instead of keeping all in memory
2. **Resume capability**: Checkpoint progress and resume if interrupted
3. **Distributed processing**: Run multiple instances to divide work
4. **Incremental comparison**: Only check tables modified since last run
5. **Compression**: Compress schemas before comparison for very large datasets

## Conclusion

These improvements allow dbcompare to scale to databases with 100,000+ tables while maintaining reasonable performance and memory usage. The parallel processing architecture can be tuned based on database capabilities and network conditions to achieve optimal throughput.
