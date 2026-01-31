resource "snowflake_table" "RDV_MDM_REF_MDM_DOMAINE_VALEUR" {
  database = local.databases[var.DATABASE]
  schema = snowflake_schema.RDV_MDM.name
  name = "REF_MDM_DOMAINE_VALEUR"


  column {
    name = "HK_REF_MDM_DOMAINE_VALEUR"
    type = "VARCHAR(40)"
    nullable = false
    comment = "HASHKEY"
  }

  column {
    name = "NOM_DOMAINE_VALEUR"
    type = "VARCHAR(16777216)"
  }

  column {
    name = "MASTER_CODE"
    type = "VARCHAR(16777216)"
  }

  column {
    name = "DESCRIPTION_FRANCAISE"
    type = "VARCHAR(16777216)"
  }

  column {
    name = "DESCRIPTION_ANGLAISE"
    type = "VARCHAR(16777216)"
  }

  column {
    name = "MD_HASHDIFF"
    type = "VARCHAR(40)"
    nullable = false
  }

  column {
    name = "MD_START_DT"
    type = "VARCHAR(40)"
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
    name = "MD_MODIFY_AUDIT_ID"
    type = "VARCHAR(16777216)"
    nullable = false
    comment = "UID-ADF DE LA MISE A JOUR"
  }

  column {
    name = "MD_MODIFY_DT"
    type = "TIMESTAMP_NTZ(9)"
    nullable = false

    default {
      expression = "CURRENT_TIMESTAMP()"
    }
  }
}

resource "snowflake_table_constraint" "RDV_MDM_REF_MDM_DOMAINE_VALEUR_PK_REF_MDM_DOMAINE_VALEUR" {
  name = "PK_REF_MDM_DOMAINE_VALEUR"

  type = "PRIMARY KEY"
  table_id = snowflake_table.RDV_MDM_REF_MDM_DOMAINE_VALEUR.fully_qualified_name

  columns = [
    "HK_REF_MDM_DOMAINE_VALEUR"
  ]
  deferrable = false
  enable = false
  rely = true
}

