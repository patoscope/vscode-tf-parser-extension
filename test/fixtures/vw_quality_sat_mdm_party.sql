create or replace view DB_CDI_DEV_DWH.RDV_MDM_SANDBOX.VW_QUALITY_SAT_MDM_PARTY(
	TEST_NAME,
	OBJECT_NAME,
	MISSING_VALUE
) as with cte_last_version as(
    SELECT *
    FROM DB_CDI_DEV_DWH.RDV_MDM_SANDBOX.VW_SAT_MDM_PARTY
    WHERE TO_DATE(MD_END_DT) = '9999-12-31' -- on va chercher le dernier enregistrement d'une clé
        AND MD_IS_DELETED = '0' -- on veut faire de la qualité uniquement sur les lignes non-supprimées de mdm
)

SELECT 
    'Missing References (SAT sans HUB)' AS TEST_NAME, 
    'SAT_MDM_PARTY' AS OBJECT_NAME,
     CONCAT_WS('|', a.HK_HUB_PARTY, 'MASTER_ID', nvl(a.ID_PARTY,'#null#'), a.MD_START_DT) AS MISSING_VALUE
FROM cte_last_version a
    LEFT JOIN DB_CDI_DEV_DWH.RDV_MDM_SANDBOX.HUB_MDM_PARTY b
        ON a.hk_hub_party = b.hk_hub_party
WHERE b.hk_hub_party IS NULL

UNION ALL

-- est-ce qu'on veut aller chercher uniquement la dernière ligne de chacun des SAT ... sinon "l erreur" restera toujours présente"
SELECT 
    'Quality : Domaine de valeur pour Party_Type_Code' AS TEST_NAME, 
    'SAT_MDM_PARTY' AS OBJECT_NAME,
     CONCAT_WS('|', 'MASTER_ID', ID_PARTY, MD_START_DT, 'PARTY_TYPE_CODE', CMO_PARTYTYPECODE) AS MISSING_VALUE
FROM cte_last_version
WHERE CMO_PARTYTYPECODE is null

/*
UNION ALL

SELECT 
    'Quality : Domaine de valeur pour Gender_Code' AS TEST_NAME, 
    'SAT_MDM_PARTY' AS OBJECT_NAME,
     CONCAT_WS('|', 'MASTER_ID', ID_PARTY, MD_START_DT, 'GENDER_CODE', CMO_GENDERCODE) AS MISSING_VALUE
FROM cte_last_version
WHERE CMO_GENDERCODE IN('XIN', 'XER')

UNION ALL

SELECT 
    'Quality : Domaine de valeur pour Civil_Status_Code' AS TEST_NAME, 
    'SAT_MDM_PARTY' AS OBJECT_NAME,
     CONCAT_WS('|', 'MASTER_ID', ID_PARTY, MD_START_DT, 'CIVIL_STATUS_CODE', CMO_CIVILSTATUSCODE) AS MISSING_VALUE
FROM cte_last_version
WHERE CMO_CIVILSTATUSCODE IN('XIN', 'XER')

UNION ALL

SELECT 
    'Quality : Domaine de valeur pour Education_Code' AS TEST_NAME, 
    'SAT_MDM_PARTY' AS OBJECT_NAME,
     CONCAT_WS('|', 'MASTER_ID', ID_PARTY, MD_START_DT, 'EDUCATION_CODE', CMO_EDUCATIONCODE) AS MISSING_VALUE
FROM cte_last_version
WHERE CMO_EDUCATIONCODE IN('XIN', 'XER')

UNION ALL

SELECT 
    'Quality : Domaine de valeur pour Organization_Type_Code' AS TEST_NAME, 
    'SAT_MDM_PARTY' AS OBJECT_NAME,
     CONCAT_WS('|', 'MASTER_ID', ID_PARTY, MD_START_DT, 'ORGANIZATION_TYPE_CODE', CMO_ORGANIZATIONTYPECODE) AS MISSING_VALUE
FROM cte_last_version
WHERE CMO_ORGANIZATIONTYPECODE IN('XIN', 'XER')
*/;
