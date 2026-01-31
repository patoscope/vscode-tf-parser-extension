resource "snowflake_table" "RDV_MDM_LINK_MDM_PARTY_CONTRACT_ROLE" {
  database = local.databases[var.DATABASE]
  schema = snowflake_schema.RDV_MDM.name
  name = "LINK_MDM_PARTY_CONTRACT_ROLE"


  column {
    name = "HK_LINK_PARTY_CONTRACT_ROLE"
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
    name = "HK_HUB_PARTY"
    type = "VARCHAR(40)"
    comment = "Hashkey"
  }

  column {
    name = "HK_HUB_CONTRACT"
    type = "VARCHAR(40)"
    comment = "Hashkey"
  }

  column {
    name = "ID_ROLE"
    type = "VARCHAR(16777216)"
  }

  column {
    name = "ID_PARTY"
    type = "VARCHAR(16777216)"
  }

  column {
    name = "ID_CONTRACT"
    type = "VARCHAR(16777216)"
  }
}

resource "snowflake_table_constraint" "RDV_MDM_LINK_MDM_PARTY_CONTRACT_ROLE_PK_LINK_PARTY_CONTRACT_ROLE" {
  name = "PK_LINK_PARTY_CONTRACT_ROLE"

  type = "PRIMARY KEY"
  table_id = snowflake_table.RDV_MDM_LINK_MDM_PARTY_CONTRACT_ROLE.fully_qualified_name

  columns = [
    "HK_LINK_PARTY_CONTRACT_ROLE"
  ]
  deferrable = false
  enable = false
  rely = true
}

