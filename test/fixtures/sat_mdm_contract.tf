resource "snowflake_table" "RDV_MDM_SAT_MDM_CONTRACT" {
  database = local.databases[var.DATABASE]
  schema = snowflake_schema.RDV_MDM.name
  name = "SAT_MDM_CONTRACT"


  column {
    name = "HK_HUB_CONTRACT"
    type = "VARCHAR(40)"
    nullable = false
    comment = "Hashkey"
  }

  column {
    name = "MD_HASHDIFF"
    type = "VARCHAR(40)"
    nullable = false
  }

  column {
    name = "MD_START_DT"
    type = "TIMESTAMP_NTZ(9)"
    nullable = false
  }

  column {
    name = "MD_IS_DELETED"
    type = "NUMBER(1,0)"
    nullable = false

    default {
      constant = 0
    }
  }

  column {
    name = "MD_FILENAME"
    type = "VARCHAR(16777216)"
    nullable = false
    comment = "NOM DU FICHIER"
  }

  column {
    name = "MD_SOURCE"
    type = "VARCHAR(16777216)"
    nullable = false
  }

  column {
    name = "MD_CREATION_AUDIT_ID"
    type = "VARCHAR(16777216)"
    nullable = false
    comment = "UID-ADF DE INSERTION"
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
    name = "ID_CONTRACT"
    type = "VARCHAR(16777216)"
  }

  column {
    name = "CMO_BUSINESSENTITYCODE"
    type = "VARCHAR(16777216)"
  }

  column {
    name = "CMO_SYSTEMORGCODE"
    type = "VARCHAR(16777216)"
  }

  column {
    name = "CMO_CONTRACTNUMBER"
    type = "VARCHAR(16777216)"
  }

  column {
    name = "CMO_CONTRACTSTATUSCODE"
    type = "VARCHAR(16777216)"
  }

  column {
    name = "CMO_STATUSDATE"
    type = "VARCHAR(16777216)"
  }

  column {
    name = "CMO_DISTRICT"
    type = "VARCHAR(16777216)"
  }

  column {
    name = "CMO_SERVICEUNIT"
    type = "VARCHAR(16777216)"
  }

  column {
    name = "CMO_PRODUCTTYPECODE"
    type = "VARCHAR(16777216)"
  }
}

resource "snowflake_table_constraint" "RDV_MDM_SAT_MDM_CONTRACT_PK_SAT_MDM_CONTRACT" {
  name = "PK_SAT_MDM_CONTRACT"

  type = "PRIMARY KEY"
  table_id = snowflake_table.RDV_MDM_SAT_MDM_CONTRACT.fully_qualified_name

  columns = [
    "HK_HUB_CONTRACT",
    "MD_START_DT"
  ]
  deferrable = false
  enable = false
  rely = true
}

