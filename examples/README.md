# dbcompare Examples

This directory contains examples demonstrating how to use dbcompare in various scenarios.

## Files

### 1. `basic-usage.sh`
Shell script examples showing common CLI usage patterns:
- Basic text comparison
- HTML report generation
- Browser integration
- Custom output paths
- Different connection string formats
- Cross-server comparisons

**Usage:**
```bash
chmod +x basic-usage.sh
./basic-usage.sh
```

### 2. `programmatic-usage.js`
JavaScript example for using dbcompare as a library in Node.js applications.

**Features demonstrated:**
- Schema comparison
- Report generation (HTML and text)
- Accessing comparison results
- Processing specific changes
- Generating migration hints

**Usage:**
```bash
node programmatic-usage.js
```

### 3. `programmatic-usage.ts`
TypeScript example with advanced features and type safety.

**Features demonstrated:**
- Type-safe schema comparison
- Detailed change analysis
- Migration plan generation
- Comprehensive reporting
- Error handling

**Usage:**
```bash
npx ts-node programmatic-usage.ts
```

## Setting Up Test Databases

To run these examples, you'll need two PostgreSQL databases. Here's how to set them up:

```bash
# Create source database
createdb source_db

# Create target database
createdb target_db

# Add some test data (example)
psql source_db << EOF
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
EOF

# Modify the schema in target database
psql target_db << EOF
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,  -- Changed length
  last_login TIMESTAMP,           -- Added column
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_last_login ON users(last_login);  -- Added index

CREATE TABLE sessions (                -- New table
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL
);
EOF
```

## Expected Results

When comparing these test databases, you should see:

### Modified Tables (1)
- **users**
  - Column modified: `email` (length changed from 100 to 255)
  - Column added: `last_login`
  - Index added: `idx_users_last_login`

### Added Tables (1)
- **sessions**
  - 4 columns
  - 1 primary key
  - 1 foreign key

## Tips

1. **Sensitive Data**: Never commit connection strings with real credentials to version control
2. **Environment Variables**: Use environment variables for credentials in production
3. **Testing**: Always test on non-production databases first
4. **Backups**: Create backups before applying any migrations

## Environment Variables Example

Instead of hardcoding credentials, use environment variables:

```bash
export SOURCE_DB="postgresql://postgres:password@localhost:5432/source_db"
export TARGET_DB="postgresql://postgres:password@localhost:5432/target_db"

dbcompare -s "$SOURCE_DB" -t "$TARGET_DB" --html -o
```

Or create a `.env` file (don't commit this!):
```
SOURCE_DB=postgresql://postgres:password@localhost:5432/source_db
TARGET_DB=postgresql://postgres:password@localhost:5432/target_db
```

Then load it in your script:
```javascript
require('dotenv').config();

const sourceConnection = process.env.SOURCE_DB;
const targetConnection = process.env.TARGET_DB;
```
