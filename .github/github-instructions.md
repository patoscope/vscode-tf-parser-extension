# VS Code TF Parser Extension - Project Context & Architecture

## Key rule
When running commands in the terminal, use Powershell syntax

## 📋 Project Overview

The **vscode-tf-parser-extension** (sf2tf) is a VS Code extension that converts Snowflake SQL DDL statements into Terraform HCL configuration files. The extension is marked as "PRODUCTION READY" but requires validation and improvements using real-world SQL/TF reference files from the CDI-TOPICS-SNOWFLAKE-IAFG-DCM repository.

### Current Status
- **Version**: 0.2.8
- **Target Snowflake Provider**: ~> 0.84
- **Test Count**: 18 tests (as documented, but appears incomplete)
- **Language**: TypeScript
- **Build Tool**: Webpack
- **Target**: VS Code ^1.101.0

## 🏗️ Architecture Overview

### Extension Components

```
src/
├── extension.ts           # Main VS Code extension entry point & command handlers
├── sqlParser.ts          # SQL DDL parser for Snowflake syntax
├── terraformConverter.ts # Converts parsed SQL objects to Terraform HCL
└── test/                 # Test suite files
```

### Key Interfaces & Types

**From sqlParser.ts:**
```typescript
- ColumnDefinition        // Table column metadata
- TableDefinition         // CREATE TABLE representation
- ViewDefinition          // CREATE VIEW representation  
- ProcedureDefinition     // CREATE PROCEDURE representation
- DDLObject              // Union type of all three
```

**From terraformConverter.ts:**
```typescript
- TerraformResource      // Intermediate representation before HCL generation
```

## 🎯 Core Functionality

### Parser (sqlParser.ts)

**Capabilities:**
- Splits multiple SQL statements from single file
- Identifies and parses CREATE TABLE statements with:
  - Column definitions (name, type, nullable, default values)
  - Column comments
  - Table comments
  - CLUSTER BY clauses
  - Schema and database prefixes
  - CREATE OR REPLACE modifiers

- Identifies and parses CREATE VIEW statements with:
  - Full query statement extraction
  - SECURE view detection
  - OR REPLACE modifier
  - View comments
  - Schema and database prefixes

- Identifies and parses CREATE PROCEDURE statements with:
  - Parameter definitions (name, type, defaults)
  - Return types
  - Language specification
  - Procedure body extraction
  - Procedure comments
  - Schema and database prefixes

**Comment Handling:**
- Line comments (`--`)
- Block comments (`/* ... */`)
- Dollar-quoted strings (`$tag$...$tag$`)

**Limitations:**
- Complex nested queries in views may not preserve all whitespace perfectly
- Procedure bodies are extracted as-is without parsing internal SQL

### Converter (terraformConverter.ts)

**Conversion Process:**
1. Converts parsed DDL objects to Terraform resource format
2. Generates HCL-formatted content strings
3. Analyzes dependencies between resources
4. Generates complete Terraform file with provider blocks

**Generated Resource Types:**
- `snowflake_table` - From TableDefinition
- `snowflake_view` - From ViewDefinition
- `snowflake_procedure` - From ProcedureDefinition

**Key Generation Details:**
- Resource names: Generated from object name + schema (e.g., `table_schema_objectname`)
- Column definitions: Nested `column { }` blocks with type, nullable, defaults, comments
- Schema references: Uses `snowflake_schema.{schema_ref}.name`
- Database references: Uses `local.databases[var.DATABASE]`
- View statements: Uses heredoc (`<<-EOT`) for SQL queries
- Procedure statements: Uses heredoc for procedure body
- Default values: Separated into `constant` or `expression` variants

## 📊 Reference Material: CDI-TOPICS-SNOWFLAKE-IAFG-DCM

### Structure
```
CDI-TOPICS-SNOWFLAKE-IAFG-DCM/
├── _sql/                          # SQL Source Files
│   ├── db_cdi_dev_dm/            # Data Mart Layer
│   │   ├── cdi_sandbox/
│   │   │   ├── Tables/*.sql      # Table definitions
│   │   │   ├── Views/*.sql       # View definitions
│   │   │   └── Procedures/*.sql  # Stored procedures
│   │   ├── dsml_publication_sandbox/
│   │   ├── gcx_publication_sandbox/
│   │   └── ... (11 more sandboxes)
│   ├── db_cdi_dev_dwh/            # Data Warehouse Layer
│   │   ├── bdv_hubspot_sandbox/
│   │   ├── rdv_cdi_sandbox/
│   │   └── ... (13 more sandboxes)
│   └── db_cdi_dev_stg/            # Staging Layer
│       └── 12 different staging schemas
├── CDI/                            # Terraform Code (Reference Implementation)
│   └── DWH/
│       └── RDV_CDI/
│           ├── tables/
│           │   └── rdv.tables.*.tf
│           ├── views/
│           │   └── rdv.views.*.tf
│           └── procedures/
│               └── rdv.procedures.*.tf
└── ... (other topic folders: COLLECTIF, DSML, HUBSPOT, IAAH, etc.)
```

### Reference Example: Table Conversion

**SQL Source** (`_sql/db_cdi_dev_dm/cdi_sandbox/Tables/dim_client_segment.sql`):
```sql
create or replace TABLE DB_CDI_DEV_DM.CDI_SANDBOX.DIM_CLIENT_SEGMENT (
    MD_HASHDIFF VARCHAR(64) NOT NULL,
    MD_HASH_NAT_KEYS VARCHAR(64) NOT NULL COMMENT 'Hashkey du...',
    MD_SOURCE VARCHAR(50) NOT NULL,
    MD_START_DT TIMESTAMP_NTZ(9) NOT NULL,
    DECIMAL DECIMAL(38,18) DEFAULT 0.0 COMMENT 'Optional decimal column',
    DIM_CLIENT_TYPE_KEY VARCHAR(64) NOT NULL,
    constraint PK_DIM_CLIENT_SEGMENT primary key (DIM_CLIENT_SEGMENT_KEY) rely
);
```

**Terraform Reference** (`CDI/DWH/RDV_CDI/tables/rdv.tables.ref_lob_product.tf`):
```hcl
resource "snowflake_table" "RDV_CDI_REF_LOB_PRODUCT" {
  database = local.databases[var.DATABASE]
  schema = snowflake_schema.RDV_CDI.name
  name = "REF_LOB_PRODUCT"

  column {
    name = "HK_REF_LOB_PRODUCT"
    type = "VARCHAR(64)"
    nullable = false
    comment = "Hashkey"
  }

  column {
    name = "MD_HASHDIFF"
    type = "VARCHAR(64)"
    nullable = false
  }

  column {
    name = "MD_CREATION_DT"
    type = "TIMESTAMP_NTZ(9)"
    nullable = false
    comment = "DATE ET HEURE INSERE"
    default {
      expression = "CURRENT_TIMESTAMP()"
    }
  }

  column {
    name = "MD_IS_DELETED"
    type = "NUMBER(1,0)"
    nullable = false
    default {
      constant = 0
    }
  }
}
```

### Key Observations from Reference Files

1. **Schema Naming Convention**: `RDV_CDI`, `BDV_HUBSPOT`, `CDI_SANDBOX`, etc.
2. **Resource Naming**: Uses combination of schema and object name (e.g., `RDV_CDI_REF_LOB_PRODUCT`)
3. **Database/Schema References**: 
   - Database: `local.databases[var.DATABASE]`
   - Schema: `snowflake_schema.{SCHEMA_NAME}.name`
4. **Default Values**:
   - Constant defaults: `default { constant = 0 }`
   - Expression defaults: `default { expression = "CURRENT_TIMESTAMP()" }`
5. **Comments**: Preserved per column and at table level
6. **Column Attributes**: name, type, nullable, comment, default (with nested structure)
7. **Constraints**: Primary keys referenced in comments but not explicitly in TF blocks

## 🔍 Current Known Issues & Gaps

### Issue Categories

1. **Parser Limitations**
   - Constraint handling: PRIMARY KEY, FOREIGN KEY, CHECK constraints are not extracted
   - Complex default expressions: May not handle all Snowflake functions
   - Multi-line column definitions: Edge cases with formatting
   - Collation and encoding specifications: Not supported

2. **Converter Output Issues**
   - Constraint representation: Need to determine best TF representation
   - Complex nested types: VARIANT, OBJECT, ARRAY types may need special handling
   - Scale/precision handling: DECIMAL(p,s) and NUMBER(p,s) format preservation
   - View dependency tracking: May not correctly identify views depending on other views

3. **VS Code Integration**
   - Resource naming conflicts: Duplicate object names in different schemas
   - Large file handling: Performance with files containing 100+ statements
   - Error reporting: Incomplete feedback for parsing failures

4. **Test Coverage**
   - Real-world file validation: Extension not tested against actual CDI SQL files
   - View statement preservation: Not validated against actual complex views
   - Procedure body handling: Limited testing of real procedure logic
   - Multi-schema scenarios: Not thoroughly tested

## 🚀 Improvement Strategy

### Phase 1: Validation & Reference Integration
1. Extract sample SQL files from CDI-TOPICS-SNOWFLAKE-IAFG-DCM
2. Convert using current extension
3. Compare output against reference TF files
4. Document discrepancies

### Phase 2: Parser Enhancements
1. Improve constraint detection and extraction
2. Better handling of complex expressions in defaults
3. Improved view query preservation
4. Better support for Snowflake-specific data types

### Phase 3: Converter Improvements
1. Better constraint representation in Terraform
2. Improved resource naming to avoid collisions
3. Better dependency analysis for views
4. Additional Terraform resource types if needed

### Phase 4: Testing & Validation
1. Create comprehensive test suite using real CDI files
2. Add regression tests for each fix
3. Improve error messages and diagnostics
4. Performance testing with large files

## 📝 Development Guidelines

### Adding New Features
1. Create unit tests first (TDD approach)
2. Run `npm test` to validate
3. Test manually in extension with various SQL files
4. Update documentation
5. Cross-reference with CDI examples

### Testing Locally
```bash
npm install           # Install dependencies
npm run build         # Build TypeScript
npm test              # Run unit tests
npm run webpack       # Build for distribution
```

### Extension Development Host
- Press F5 in VS Code to launch Extension Development Host
- Test commands: `Ctrl+Shift+P` → "Snowflake to Terraform"

## 📂 Test Data Available

### Sample Files
- `test-data/sample.sql` - Basic test file
- `test-data/test_simple.sql` - Simple CREATE statements
- `test-data/test_ddl.sql` - Comprehensive DDL examples
- `test-data/integration_test.sql` - Multi-object integration test

### Real Reference Data
- CDI-TOPICS-SNOWFLAKE-IAFG-DCM/_sql/ - 62+ SQL files (Tables, Views, Procedures)
- CDI-TOPICS-SNOWFLAKE-IAFG-DCM/CDI/DWH/RDV_CDI/ - Reference Terraform files
- Multiple topic folders with complete SQL/TF pairs (COLLECTIF, DSML, HUBSPOT, IAAH, etc.)

## 🎯 Success Criteria

The extension should:
1. ✅ Parse all SQL files in CDI-TOPICS-SNOWFLAKE-IAFG-DCM/_sql without errors
2. ✅ Generate Terraform that matches the reference files in CDI/DWH/RDV_CDI/
3. ✅ Handle complex views with multi-line queries
4. ✅ Preserve all comments and metadata
5. ✅ Generate valid HCL syntax
6. ✅ Properly reference schemas and databases using local variables
7. ✅ Handle constraints appropriately (possibly in comments if not natively supported)

## 📖 Related Documentation

- [README.md](../README.md) - User-facing documentation
- [DEVELOPMENT_SUMMARY.md](../docs/DEVELOPMENT_SUMMARY.md) - Current status and achievements
- [INSTALLATION_GUIDE.md](../docs/INSTALLATION_GUIDE.md) - Installation instructions
- [USAGE.md](../docs/USAGE.md) - Usage examples
