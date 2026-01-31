resource "snowflake_view" "RDV_MDM_VW_SAT_MDM_PARTY" {
  database = local.databases[var.DATABASE]
  schema = snowflake_schema.RDV_MDM.name
  name = "VW_SAT_MDM_PARTY"

  copy_grants = true
  statement = <<-EOT
SELECT 
  HK_HUB_PARTY,
	MD_HASHDIFF,
	MD_START_DT,
  NVL(LEAD(DATEADD(millisecond, -1, MD_START_DT), 1) OVER (PARTITION BY HK_HUB_PARTY ORDER BY MD_START_DT ASC, MD_CREATION_DT ASC), '9999-12-31 23:59:59.9999'::timestamp_ntz(9)) AS MD_END_DT,
	MD_IS_DELETED,
	MD_FILENAME,
	MD_SOURCE,
	MD_CREATION_AUDIT_ID,
	MD_CREATION_DT,
	ID_PARTY,
	CMO_PARTYTYPECODE,
	CMO_GENDERCODE,
	CMO_CIVILSTATUSCODE,
	CMO_DATEOFBIRTH,
	CMO_DATEOFDEATH,
	CMO_ISDECEASED,
	CMO_EDUCATIONCODE,
	CMO_EMPLOYER,
	CMO_GLOBALCONSENTVALUECODE,
	CMO_GLOBALCONSENTRECEIVEDDATE,
	CMO_FISCALYEARENDMONTHCODE,
	CMO_FISCALYEARENDDAY,
	CMO_CREATIONDATE,
	CMO_BUSINESSENTITYCODE,
	CMO_JOBTITLE,
	CMO_ORGANIZATIONTYPECODE
FROM ${local.databases["DWH"]}.RDV_MDM.SAT_MDM_PARTY;
EOT

depends_on = [
  snowflake_table.RDV_MDM_SAT_MDM_PARTY
  ]

  column {
    column_name = "HK_HUB_PARTY"
  }

  column {
    column_name = "MD_HASHDIFF"
  }

  column {
    column_name = "MD_START_DT"
  }

  column {
    column_name = "MD_END_DT"
  }

  column {
    column_name = "MD_IS_DELETED"
  }

  column {
    column_name = "MD_FILENAME"
  }

  column {
    column_name = "MD_SOURCE"
  }

  column {
    column_name = "MD_CREATION_AUDIT_ID"
  }

  column {
    column_name = "MD_CREATION_DT"
  }

  column {
    column_name = "ID_PARTY"
  }

  column {
    column_name = "CMO_PARTYTYPECODE"
  }

  column {
    column_name = "CMO_GENDERCODE"
  }

  column {
    column_name = "CMO_CIVILSTATUSCODE"
  }

  column {
    column_name = "CMO_DATEOFBIRTH"
  }

  column {
    column_name = "CMO_DATEOFDEATH"
  }

  column {
    column_name = "CMO_ISDECEASED"
  }

  column {
    column_name = "CMO_EDUCATIONCODE"
  }

  column {
    column_name = "CMO_EMPLOYER"
  }

  column {
    column_name = "CMO_GLOBALCONSENTVALUECODE"
  }

  column {
    column_name = "CMO_GLOBALCONSENTRECEIVEDDATE"
  }

  column {
    column_name = "CMO_FISCALYEARENDMONTHCODE"
  }

  column {
    column_name = "CMO_FISCALYEARENDDAY"
  }

  column {
    column_name = "CMO_CREATIONDATE"
  }

  column {
    column_name = "CMO_BUSINESSENTITYCODE"
  }

  column {
    column_name = "CMO_JOBTITLE"
  }

  column {
    column_name = "CMO_ORGANIZATIONTYPECODE"
  }
}

