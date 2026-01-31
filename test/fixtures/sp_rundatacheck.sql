CREATE OR REPLACE PROCEDURE DB_CDI_DEV_DWH.RDV_MDM_SANDBOX.SP_RUNDATACHECK("P_AUDIT_ID" VARCHAR(100))
RETURNS VARCHAR(16777216)
LANGUAGE JAVASCRIPT
COMMENT='user-defined procedure'
EXECUTE AS OWNER
AS '
    // Extraction des paramètres de BD et Schema
    var sSql_Description = `Select CURRENT_DATABASE() as DB_Name, CURRENT_SCHEMA() as Schema_Name`;

    var objSqlCmd_DB_PARAM = {sqlText: sSql_Description}
    var objStmt_DB_PARAM = snowflake.createStatement(objSqlCmd_DB_PARAM);  
    var objRs_DB_PARAM = objStmt_DB_PARAM.execute();  
          
    while (objRs_DB_PARAM.next()){
          vDatabase = objRs_DB_PARAM.getColumnValue(1);
          vSchema = objRs_DB_PARAM.getColumnValue(2);
     };
    
    // Pour les version en DEV, aligne le nom du schéma tools avec le nom du schéma applicatif source.
    var vToolsSchema = "TOOLS"
    var vLen = vSchema.length
        
    if (vSchema.toUpperCase().slice(vLen-8, vLen) == "_SANDBOX")
    {
        vToolsSchema = vToolsSchema + "_SANDBOX"
    }

    // ===============================================================================================================================================
    // Lance les appels de validation des Row Count
    // ===============================================================================================================================================
    //var sql_sp_CheckRowCount = "CALL " + vDatabase + "." + vToolsSchema + ".sp_CheckRowCount(?,?,?,?,?,?)"
    
    // snowflake.execute( {sqlText: sql_sp_CheckRowCount, binds:[P_AUDIT_ID, "Staging Comptable", "Périodes Fiscales", vDatabase, vSchema, "GL_FISCAL_PERIOD"]});

    // Le code pour les objets de DM devrait être mis dans une procédure dans le schéma DM.
    //snowflake.execute( {sqlText: "CALL DB_CTB_dev_DWH.Tools.sp_CheckRowCount(?,?,?,?,?)", binds:[P_AUDIT_ID, "Transactions DM", vDatabase, vSchema, "TRANSACTIONS"]} );
    
    // ===============================================================================================================================================
    // Lance les appels de validation des Duplicates
    // ===============================================================================================================================================
    var sql_sp_CheckDuplicate = `CALL ${vDatabase}.${vToolsSchema}.sp_CheckDuplicate(?,?,?,?,?,?,?)`

    // MDM
    snowflake.execute( {sqlText: sql_sp_CheckDuplicate, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "HUB_MDM_PARTY", "HK_HUB_PARTY"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDuplicate, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "SAT_MDM_PARTY", "HK_HUB_PARTY, MD_START_DT"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDuplicate, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "SAT_MDM_INDIVIDUAL_NAME", "HK_HUB_PARTY, ID, MD_START_DT"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDuplicate, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "SAT_MDM_ORGANIZATION_NAME", "HK_HUB_PARTY, ID, MD_START_DT"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDuplicate, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "SAT_MDM_ADDRESS", "HK_HUB_PARTY, ID, MD_START_DT"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDuplicate, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "SAT_MDM_ALTERNATE_IDENTIFIER", "HK_HUB_PARTY, ID, MD_START_DT"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDuplicate, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "SAT_MDM_EMAIL", "HK_HUB_PARTY, ID, MD_START_DT"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDuplicate, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "SAT_MDM_PHONE", "HK_HUB_PARTY, ID, MD_START_DT"]} );     
    snowflake.execute( {sqlText: sql_sp_CheckDuplicate, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "SAT_MDM_PREFERENCE", "HK_HUB_PARTY, ID, MD_START_DT"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDuplicate, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Role", vDatabase, vSchema, "LINK_MDM_PARTY_CONTRACT_ROLE", "HK_LINK_PARTY_CONTRACT_ROLE"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDuplicate, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Role", vDatabase, vSchema, "SAT_MDM_PARTY_CONTRACT_ROLE", "HK_LINK_PARTY_CONTRACT_ROLE, MD_START_DT"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDuplicate, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Contrat", vDatabase, vSchema, "HUB_MDM_CONTRACT", "HK_HUB_CONTRACT"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDuplicate, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Contrat", vDatabase, vSchema, "SAT_MDM_CONTRACT", "HK_HUB_CONTRACT, MD_START_DT"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDuplicate, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "REF_MDM_PARTY_SOURCE_CLIENT", "HK_REF_MDM_PARTY_SOURCE_CLIENT, MD_START_DT"]} );
       
    // ===============================================================================================================================================
    // Lance les appels de validation de qualité des données. Chaque objet à vérifier doit être encapsulé dans une vue standard préfixé de v_quality dans le schema UnitTests
    // ===============================================================================================================================================
    var sql_sp_CheckDataQuality = `CALL ${vDatabase}.${vToolsSchema}.sp_CheckDataQuality(?,?,?,?,?,?)`
    
    // MDM
    snowflake.execute( {sqlText: sql_sp_CheckDataQuality, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "VW_QUALITY_SAT_MDM_PARTY"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDataQuality, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "VW_QUALITY_SAT_MDM_INDIVIDUAL_NAME"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDataQuality, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "VW_QUALITY_SAT_MDM_ORGANIZATION_NAME"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDataQuality, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "VW_QUALITY_SAT_MDM_ADDRESS"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDataQuality, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "VW_QUALITY_SAT_MDM_ALTERNATE_IDENTIFIER"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDataQuality, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "VW_QUALITY_SAT_MDM_PREFERENCE"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDataQuality, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "VW_QUALITY_SAT_MDM_PHONE"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDataQuality, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "VW_QUALITY_SAT_MDM_EMAIL"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDataQuality, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Party", vDatabase, vSchema, "VW_QUALITY_SAT_MDM_PARTY_CONTRACT_ROLE"]} );
    snowflake.execute( {sqlText: sql_sp_CheckDataQuality, binds:[P_AUDIT_ID, "Client Data Insight - MDM", "Contrat", vDatabase, vSchema, "VW_QUALITY_SAT_MDM_CONTRACT"]} );
return "Done";
';
