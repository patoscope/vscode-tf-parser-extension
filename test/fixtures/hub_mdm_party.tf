resource "snowflake_table" "RDV_MDM_HUB_MDM_PARTY" {
  database = local.databases[var.DATABASE]
  schema = snowflake_schema.RDV_MDM.name
  name = "HUB_MDM_PARTY"


  column {
    name = "HK_HUB_PARTY"
    type = "VARCHAR(40)"
    nullable = false
    comment = "Hashkey"
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
    name = "ID_PARTY"
    type = "VARCHAR(16777216)"
    comment = "colonne ID de l'agence"
  }
}

resource "snowflake_table_constraint" "RDV_MDM_HUB_MDM_PARTY_PK_HUB_PARTY" {
  name = "PK_HUB_PARTY"

  type = "PRIMARY KEY"
  table_id = snowflake_table.RDV_MDM_HUB_MDM_PARTY.fully_qualified_name

  columns = [
    "HK_HUB_PARTY"
  ]
  deferrable = false
  enable = false
  rely = true
}

