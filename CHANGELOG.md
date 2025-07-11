# Change Log

All notable changes to the "sf2tf" extension will be documented in this file.

## [0.2.4] - 2025-07-11

### Fixed
- **Default Value Handling**: Fixed default value generation in Terraform output to use `expression` instead of `constant`
  - `DEFAULT 0` now generates `default { expression = "0" }` instead of `default { constant = "0" }`
  - `DEFAULT CURRENT_TIMESTAMP()` now generates `default { expression = "CURRENT_TIMESTAMP()" }`
  - Affects all column default values in CREATE TABLE statements

## [0.2.3] - 2025-07-08

### Improved
- **Code Cleanup**: Removed temporary development dependencies and scripts
- **Package Optimization**: Cleaned up development artifacts for production release

## [0.2.0] - 2025-07-08

### Added
- **Schema Reference Cleanup**: Automatic removal of `_SANDBOX` suffix from schema references
- **Improved Schema Mapping**: Schema references now use clean names (e.g., `RDV_SANDBOX` → `snowflake_schema.RDV.name`)
- **Enhanced Testing**: Added specific test cases for `_SANDBOX` suffix removal

### Changed
- **Schema Reference Generation**: `convertToSchemaReference()` method now removes `_SANDBOX` suffix automatically
- **Cleaner Terraform Output**: Schema references are more consistent and follow naming conventions

### Technical Details
- Schema `RDV_SANDBOX` now generates `snowflake_schema.RDV.name` instead of `snowflake_schema.RDV_SANDBOX.name`
- Resource names still retain the full schema name (e.g., `RDV_SANDBOX_SAT_SUREX_SOURCE_CONTRACT`)
- Only the schema reference in Terraform resources is cleaned up

## [0.1.0] - 2025-07-08

### Added
- **Azure DevOps Pipeline Support**: Terraform output now includes pipeline variables and local values
- **Environment-specific database references**: Uses `local.databases[var.DATABASE]` for deployment flexibility
- **Schema references**: All schema references use `snowflake_schema.{SCHEMA_NAME}.name` pattern
- **Pipeline variables**: Added `var.DATABASE` and `var.ENVIRONMENT` for environment configuration
- **Environment configurations**: Added local values for DEV/TEST/PROD environment settings

### Changed
- **Resource naming convention**: Changed from lowercase prefixed names to uppercase schema-prefixed names
- **Database references**: All database references now use local variables instead of hardcoded values
- **Provider block**: Enhanced with pipeline variables and local configurations

### Technical Details
- Tables, views, and procedures now generate Azure DevOps compatible Terraform
- Resource names follow pattern: `SCHEMA_OBJECTNAME` (e.g., `RDV_SANDBOX_SAT_SUREX_SOURCE_CONTRACT`)
- Database deployment controlled by `TF_VAR_DATABASE` pipeline variable
- Environment-specific configurations via local values

## [0.0.1] - 2025-07-07

### Added
- Initial release with basic Snowflake DDL to Terraform conversion
- Support for CREATE TABLE, CREATE VIEW, CREATE PROCEDURE statements
- VS Code commands for converting selections, files, and previewing conversions
- Comprehensive DDL parsing with support for comments, constraints, and complex SQL
- Data type mapping from Snowflake SQL to Terraform format
- Context menu integration and command palette support