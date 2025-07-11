# Installation and Usage Guide - Version 0.2.4

## 🎉 Extension Ready for Production Use!

Your Snowflake to Terraform VS Code extension with enhanced Azure DevOps pipeline support is ready for use.

## Installation Options

### Option 1: Install the Packaged Extension
```powershell
code --install-extension sf2tf-0.2.4.vsix
```

### Option 2: Development Mode (F5)
1. Open the workspace in VS Code
2. Press **F5** to launch Extension Development Host
3. Test the extension in the new window

## What's New in Version 0.2.4

### ✅ Bug Fix Release
- **Default Value Handling**: Fixed default value generation to use `expression` instead of `constant`
- **Improved Terraform Compatibility**: Default values now generate correct Terraform syntax
- **Enhanced Accuracy**: `DEFAULT 0` and `DEFAULT CURRENT_TIMESTAMP()` now work properly

### ✅ Production Ready Release (v0.2.3)
- **Code Cleanup**: Removed temporary development dependencies and scripts
- **Package Optimization**: Streamlined extension package for production use
- **Performance**: Improved build process and reduced package size

### ✅ Enhanced Schema Reference Handling (v0.2.0)
- **Automatic `_SANDBOX` Removal**: Schema references are automatically cleaned up
- **Clean Terraform Output**: `RDV_SANDBOX` → `snowflake_schema.RDV.name`
- **Preserved Resource Names**: Resource names still include full schema for clarity
- **Improved Consistency**: More predictable schema reference generation

## Quick Test

1. **Open VS Code** with the extension installed
2. **Create a test file** with this content:
   ```sql
   CREATE TABLE DB_CDI_DEV_DWH.RDV_SANDBOX.TEST_TABLE (
       id NUMBER(38,0) NOT NULL,
       name VARCHAR(100)
   );
   ```
3. **Right-click** and select "Convert Selected SQL to Terraform"
4. **Expected output**:
   ```hcl
   resource "snowflake_table" "RDV_SANDBOX_TEST_TABLE" {
     database = local.databases[var.DATABASE]
     schema   = snowflake_schema.RDV.name
     name     = "TEST_TABLE"
     # ... columns
   }
   ```

## Available Commands

| Command | Description |
|---------|-------------|
| `Snowflake to Terraform: Convert Selection` | Convert selected SQL text |
| `Snowflake to Terraform: Convert File` | Convert entire active file |
| `Snowflake to Terraform: Preview Conversion` | Preview output in new tab |

## Pipeline Deployment

Set these variables in your Azure DevOps pipeline:
- **Development**: `TF_VAR_DATABASE=DEV`
- **Testing**: `TF_VAR_DATABASE=TEST`
- **Production**: `TF_VAR_DATABASE=PROD`

## Files Included

- `sf2tf-0.2.4.vsix` - Main extension package
- `AZURE_DEVOPS_INTEGRATION.md` - Detailed pipeline integration guide
- `azure_devops_test.tf` - Example output showing pipeline pattern
- `azure_devops_test.sql` - Example SQL input

## Quality Assurance

✅ **All Tests Passing**: 18/18 tests successful  
✅ **Lint Clean**: No linting errors  
✅ **TypeScript Compiled**: No compilation errors  
✅ **Webpack Bundle**: Production build optimized (17.26 KB)  
✅ **Schema Reference Cleanup**: `_SANDBOX` suffix removal working correctly  
✅ **Code Organization**: Clean file structure with separated docs and test data
✅ **Production Ready**: Fully optimized and packaged for deployment

The extension is production-ready, fully tested, optimized, and professionally organized!
