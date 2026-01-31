resource "snowflake_table" "RDV_INDIV_HUB_INDIV_SOURCE_ADVISOR" {
  database = local.databases[var.DATABASE]
  schema = snowflake_schema.RDV_INDIV.name
  name = "HUB_INDIV_SOURCE_ADVISOR"

  comment = "Table Hub pour les conseillers source INDIV - Data Vault 2.0"
  depends_on = [
    snowflake_schema.RDV_INDIV,
  ]



  column {
    name = "HK_HUB_SOURCE_ADVISOR"
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
    name = "MD_START_DT"
    type = "TIMESTAMP_NTZ(9)"
    nullable = false
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
    name = "SOURCE_ADVISOR_IDENTIFIER"
    type = "VARCHAR(16777216)"
  }
}

resource "snowflake_table_constraint" "RDV_INDIV_HUB_INDIV_SOURCE_ADVISOR_PK_HUB_SOURCE_ADVISOR" {
  name = "PK_HUB_SOURCE_ADVISOR"

  type = "PRIMARY KEY"
  table_id = snowflake_table.RDV_INDIV_HUB_INDIV_SOURCE_ADVISOR.fully_qualified_name

  columns = [
    "HK_HUB_SOURCE_ADVISOR"
  ]
  deferrable = false
  enable = false
  rely = true
}
