#!/bin/bash

# Example 1: Compare two databases using PostgreSQL URI format
echo "Example 1: Basic comparison with text output"
dbcompare \
  -s "postgresql://postgres:password@localhost:5432/source_db" \
  -t "postgresql://postgres:password@localhost:5432/target_db"

# Example 2: Generate HTML report and open in browser
echo -e "\nExample 2: HTML report with browser preview"
dbcompare \
  -s "postgresql://postgres:password@localhost:5432/source_db" \
  -t "postgresql://postgres:password@localhost:5432/target_db" \
  --html --open

# Example 3: Output to console
echo -e "\nExample 3: Console output"
dbcompare \
  -s "postgresql://postgres:password@localhost:5432/source_db" \
  -t "postgresql://postgres:password@localhost:5432/target_db" \
  --console

# Example 4: Custom output path
echo -e "\nExample 4: Custom output location"
dbcompare \
  -s "postgresql://postgres:password@localhost:5432/source_db" \
  -t "postgresql://postgres:password@localhost:5432/target_db" \
  --html --output ./reports/schema-diff-$(date +%Y%m%d).html

# Example 5: Using simple connection format
echo -e "\nExample 5: Simple connection string format"
dbcompare \
  -s "localhost:5432:source_db:postgres:password" \
  -t "localhost:5432:target_db:postgres:password"

# Example 6: Compare databases on different servers
echo -e "\nExample 6: Different servers"
dbcompare \
  -s "postgresql://user:pass@server1.example.com:5432/production" \
  -t "postgresql://user:pass@server2.example.com:5432/staging" \
  --html -o
