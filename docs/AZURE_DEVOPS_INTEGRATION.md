# Azure DevOps Pipeline Integration

This extension generates Terraform definitions that are designed to work seamlessly with Azure DevOps pipelines for environment-specific deployments.

## Key Features

### 1. Environment Variables
The generated Terraform uses pipeline variables for environment-specific configuration:

```hcl
variable "DATABASE" {
  description = "Target database environment (e.g., DEV, TEST, PROD)"
  type        = string
}

variable "ENVIRONMENT" {
  description = "Environment name for resource naming"
  type        = string
  default     = "DEV"
}
```

### 2. Database Mapping
Local values map environment variables to actual database names:

```hcl
locals {
  databases = {
    DEV  = "DB_CDI_DEV_DWH"
    TEST = "DB_CDI_TEST_DWH"
    PROD = "DB_CDI_PROD_DWH"
  }
}
```

### 3. Resource References
All resources use pipeline-compatible references with clean schema naming:

```hcl
resource "snowflake_table" "RDV_SANDBOX_SAT_SUREX_SOURCE_CONTRACT" {
  database = local.databases[var.DATABASE]
  schema   = snowflake_schema.RDV.name  # _SANDBOX suffix automatically removed
  name     = "SAT_SUREX_SOURCE_CONTRACT"
  # ... rest of configuration
}
```

**Note**: The extension automatically removes `_SANDBOX` suffixes from schema references while preserving them in resource names for clarity.

## Azure DevOps Pipeline Usage

### Pipeline Variables
Set these variables in your Azure DevOps pipeline:

- **Development**: `TF_VAR_DATABASE=DEV`
- **Testing**: `TF_VAR_DATABASE=TEST`  
- **Production**: `TF_VAR_DATABASE=PROD`

### Example Pipeline YAML

```yaml
trigger:
- main

pool:
  vmImage: ubuntu-latest

variables:
- name: TF_VAR_DATABASE
  value: $(Environment.Database)  # Set in variable groups

stages:
- stage: terraform_plan
  jobs:
  - job: plan
    steps:
    - task: TerraformTaskV4@4
      inputs:
        provider: 'azurerm'
        command: 'plan'
        workingDirectory: '$(System.DefaultWorkingDirectory)/terraform'

- stage: terraform_apply
  dependsOn: terraform_plan
  jobs:
  - job: apply
    steps:
    - task: TerraformTaskV4@4
      inputs:
        provider: 'azurerm'
        command: 'apply'
        workingDirectory: '$(System.DefaultWorkingDirectory)/terraform'
```

### Variable Groups
Create variable groups in Azure DevOps for each environment:

**DEV Environment**:
- `Environment.Database = DEV`

**TEST Environment**:
- `Environment.Database = TEST`

**PROD Environment**:
- `Environment.Database = PROD`

## Conversion Example

### Input SQL
```sql
CREATE OR REPLACE TABLE DB_CDI_DEV_DWH.RDV_SANDBOX.SAT_SUREX_SOURCE_CONTRACT (
    id NUMBER(38,0) NOT NULL,
    contract_number VARCHAR(100) NOT NULL,
    load_date TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);
```

### Generated Terraform
```hcl
resource "snowflake_table" "RDV_SANDBOX_SAT_SUREX_SOURCE_CONTRACT" {
  database = local.databases[var.DATABASE]
  schema   = snowflake_schema.RDV.name  # _SANDBOX suffix removed automatically
  name     = "SAT_SUREX_SOURCE_CONTRACT"
  
  column {
    name = "id"
    type = "NUMBER(38,0)"
    nullable = false
  }
  
  column {
    name = "contract_number"
    type = "VARCHAR(100)"
    nullable = false
  }
  
  column {
    name = "load_date"
    type = "TIMESTAMP_NTZ"
    default {
      expression = "CURRENT_TIMESTAMP()"
    }
  }
}
```

## Benefits

1. **Single Codebase**: One Terraform configuration works across all environments
2. **Pipeline Integration**: Seamlessly integrates with Azure DevOps deployment pipelines
3. **Environment Safety**: Clear separation between DEV, TEST, and PROD deployments
4. **Resource Dependencies**: Proper Terraform resource references for schema dependencies
5. **Maintainability**: Centralized environment configuration through variables and locals
