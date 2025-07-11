terraform {
  required_providers {
    snowflake = {
      source  = "Snowflake-Labs/snowflake"
      version = "~> 0.84"
    }
  }
}

# Azure DevOps Pipeline Variables
variable "DATABASE" {
  description = "Target database environment (e.g., DEV, TEST, PROD)"
  type        = string
}

variable "ENVIRONMENT" {
  description = "Environment name for resource naming"
  type        = string
  default     = "DEV"
}

# Local values for environment-specific configuration
locals {
  databases = {
    DEV  = "DB_CDI_DEV_DWH"
    TEST = "DB_CDI_TEST_DWH"
    PROD = "DB_CDI_PROD_DWH"
  }
  
  # Environment-specific configurations can be added here
  environment_config = {
    DEV = {
      cluster_size = "X-Small"
      auto_suspend = 60
    }
    TEST = {
      cluster_size = "Small"
      auto_suspend = 300
    }
    PROD = {
      cluster_size = "Medium"
      auto_suspend = 600
    }
  }
}

provider "snowflake" {
  # Configuration will be provided via environment variables or terraform.tfvars
  # SNOWFLAKE_USER, SNOWFLAKE_PASSWORD, SNOWFLAKE_ACCOUNT, etc.
}
resource "snowflake_table" "RDV_SANDBOX_SAT_SUREX_SOURCE_CONTRACT" {
  name     = "SAT_SUREX_SOURCE_CONTRACT"
  database = local.databases[var.DATABASE]
  schema   = snowflake_schema.RDV.name

  column {
    name = "id"
    type = "NUMBER(38,0)"
    nullable = false
    comment = "Unique identifier"
  }

  column {
    name = "contract_number"
    type = "VARCHAR(100)"
    nullable = false
    comment = "Contract reference number"
  }

  column {
    name = "source_system"
    type = "VARCHAR(50)"
    nullable = false
    comment = "Source system identifier"
  }

  column {
    name = "load_date"
    type = "TIMESTAMP_NTZ"
    default {
      expression = "CURRENT_TIMESTAMP()"
    }
    comment = "Data load timestamp"
  }

  column {
    name = "hash_diff"
    type = "VARCHAR(32)"
    nullable = false
    comment = "Hash of non-key attributes"
  }
}

resource "snowflake_view" "RDV_SANDBOX_V_ACTIVE_CONTRACTS" {
  name     = "V_ACTIVE_CONTRACTS"
  database = local.databases[var.DATABASE]
  schema   = snowflake_schema.RDV.name
  statement = <<-EOT
SELECT 
        id,
        contract_number,
        source_system,
        load_date
    FROM DB_CDI_DEV_DWH.RDV_SANDBOX.SAT_SUREX_SOURCE_CONTRACT
    WHERE hash_diff IS NOT NULL
EOT
}
