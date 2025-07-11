# Snowflake DDL to Terraform Converter - Usage Guide

This VS Code extension converts Snowflake SQL DDL statements to Terraform 0.84 configuration files.

## Quick Start

1. **Install the Extension**: Press `F5` in VS Code to launch the Extension Development Host
2. **Open a SQL File**: Open any `.sql` file or create a new one
3. **Add DDL Statements**: Write or paste Snowflake DDL statements
4. **Convert**: Use one of the conversion commands

## How to Use

### Method 1: Right-Click Context Menu
1. Select the SQL DDL text you want to convert
2. Right-click and choose:
   - **Convert Selected SQL to Terraform**
   - **Convert Entire File to Terraform**
   - **Preview Terraform Conversion**

### Method 2: Command Palette
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Snowflake to Terraform"
3. Select the desired command

## Example Workflow

1. Open `examples/ecommerce_ddl.sql`
2. Select a CREATE TABLE statement
3. Right-click and choose "Convert Selected SQL to Terraform"
4. View the generated Terraform configuration
5. Save as a `.tf` file when prompted

## Sample Input/Output

### Input SQL:
```sql
CREATE OR REPLACE TABLE ecommerce.customer.customers (
    customer_id NUMBER(38,0) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    registration_date TIMESTAMP_NTZ(9) DEFAULT CURRENT_TIMESTAMP()
) COMMENT = 'Customer information table';
```

### Output Terraform:
```hcl
resource "snowflake_table" "table_customer_customers" {
  name     = "customers"
  database = "ecommerce"
  schema   = "customer"
  comment  = "Customer information table"

  column {
    name = "customer_id"
    type = "NUMBER(38,0)"
    nullable = false
  }

  column {
    name = "first_name"
    type = "VARCHAR(100)"
    nullable = false
  }

  column {
    name = "email"
    type = "VARCHAR(255)"
  }

  column {
    name = "registration_date"
    type = "TIMESTAMP_NTZ(9)"
    default {
      expression = "CURRENT_TIMESTAMP()"
    }
  }
}
```

## Testing the Extension

### Running Tests
```bash
npm test
```

### Manual Testing
1. Press `F5` to launch Extension Development Host
2. Open `test_ddl.sql` or `examples/ecommerce_ddl.sql`
3. Try the conversion commands
4. Verify the output matches expected Terraform format

### Build the Extension
```bash
npm run compile
```

### Package for Distribution
```bash
npm install -g vsce
vsce package
```

## Supported Features

- ✅ CREATE TABLE statements
- ✅ CREATE VIEW statements (including SECURE views)
- ✅ CREATE PROCEDURE statements
- ✅ Column definitions with data types
- ✅ NOT NULL constraints
- ✅ DEFAULT values
- ✅ Comments on tables and columns
- ✅ CLUSTER BY definitions
- ✅ Database and schema qualifiers
- ✅ Data type mappings

## File Structure

```
vscode-tf-parser-extension/
├── src/
│   ├── extension.ts          # Main extension entry point
│   ├── sqlParser.ts          # SQL DDL parser
│   ├── terraformConverter.ts # Terraform generator
│   └── test/                 # Test files
├── examples/
│   └── ecommerce_ddl.sql     # Example DDL file
├── test_ddl.sql              # Simple test file
├── package.json              # Extension configuration
└── README.md                 # Documentation
```

## Troubleshooting

### Extension Not Loading
- Make sure VS Code is version 1.101.0 or higher
- Check the developer console for errors (`Help > Toggle Developer Tools`)

### Parsing Issues
- Ensure SQL syntax is valid Snowflake DDL
- Complex nested structures may need manual adjustment
- Comments within column definitions may cause parsing issues

### Conversion Problems
- Check that the SQL statement type is supported
- Verify data types are recognized
- Some advanced Snowflake features may not be fully converted

## Development

### Prerequisites
- Node.js 20.x or higher
- VS Code 1.101.0 or higher

### Development Setup
```bash
git clone <repository>
cd vscode-tf-parser-extension
npm install
```

### Run in Development
```bash
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add/update tests
5. Submit a pull request

## Known Limitations

- Comments within column definitions may not parse correctly
- Some advanced Snowflake features are not supported
- Complex data types may need manual adjustment
- Stored procedure bodies are converted as-is with minimal formatting

## Next Steps

- Add support for more DDL statement types
- Improve comment handling
- Add configuration options
- Enhance error reporting
- Add syntax highlighting for generated Terraform
