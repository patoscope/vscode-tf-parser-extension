resource "snowflake_procedure_javascript" "TOOLS_USP_LOAD_HUB_V2" {
  database = local.databases[var.DATABASE]
  schema = snowflake_schema.TOOLS.name
  name = "USP_LOAD_HUB_V2"


  arguments {
    arg_name = "BD_TARGET"
    arg_data_type = "VARCHAR"
  }

  arguments {
    arg_name = "SCHEMA_TARGET"
    arg_data_type = "VARCHAR"
  }

  arguments {
    arg_name = "TARGET_NAME"
    arg_data_type = "VARCHAR"
  }

  arguments {
    arg_name = "FILENAME"
    arg_data_type = "VARCHAR"
  }

  arguments {
    arg_name = "FILEDATE"
    arg_data_type = "VARCHAR"
  }

  arguments {
    arg_name = "AUDIT_ID"
    arg_data_type = "VARCHAR"
  }
  return_type = "VARCHAR(16777216)"
  comment = "user-defined procedure"
  execute_as = "CALLER"
  procedure_definition = <<-EOT
/***************************************************************************************************
Procedure       :   USP_LOAD_HUB
Create Date     :   2022-05-19
Description     :   This procedure load a table HUB
Parameter(s)    :   @BD_TARGET     - BD Target
                    @SCHEMA_TARGET - Schema name of the target table
                    @TARGET_NAME   - Table name to be load
                    @FILENAME      - Name of the file being processed.
                    @FILEDATE      - Date of the file being processed
                    @AUDIT_ID      - Audit_ID from where the logging activity is called
                    
Prerequist      :   Column name has to be identical between source view and target table

Return Value    :   <err.message-   Will return error message if an error is thrown during processing

****************************************************************************************************
CHANGE HISTORY
Date                Author              Description
------------------- ------------------- ------------------------------------------------------------
2022-05-19          Claude Latulippe    Initial development
YYYY-MM-JJ          xxx                 xxx
***************************************************************************************************/
     try {
       var sql_text = [];
       var pre_json = "";
       var TXT_DEBUG = "";
       var JSON_HEADER = "";
       var GLOBAL_SQL_COMMAND = "";
       var SQL_COUNT = 0;

        // Use SCHEMA_TARGET parameter to determine if we are running on DEV or UNIT
        var SCHEMA_ENV = (SCHEMA_TARGET.indexOf("_DEV") != -1 ) ? "_DEV" : "";
        if (SCHEMA_ENV == "") 
	{   
            SCHEMA_ENV = (SCHEMA_TARGET.indexOf("_SANDBOX") != -1 ) ? "_SANDBOX" : "";
        }; // END IF FILE INFO

        // Use BD_TARGET parameter to determine the system name starting a 3 until next "_"
        var SYSTEM_NAME = BD_TARGET.substr(3,BD_TARGET.indexOf("_",4)-3);

        // Use BD_TARGET to determine what is the environment (DEV,ACCP,PROD)
        var DATABASE_ENV = BD_TARGET.substr(BD_TARGET.indexOf("_",4)+1                                                     // FIND 1ST "_" AFTER SYSTEM NAME 
                                           ,BD_TARGET.indexOf("_",BD_TARGET.indexOf("_",4)+1)-BD_TARGET.indexOf("_",4)-1); // FIND NEXT "_" AND SUBSTRACT POSITION OF 1ST TO DETERMINE LENGTH 
        
        // Use BD_TARGET parameter to determine where to call the TOOLS procedure
        var BD_TARGET_DWH = BD_TARGET.substr(0,BD_TARGET.indexOf("_",BD_TARGET.lastIndexOf("_"))) + "_DWH";

        // Tools schema
        var DWH_TOOLS_SCHEMA = BD_TARGET_DWH + ".TOOLS" + SCHEMA_ENV + ".";  

        // target object complete name
        var Target_definition = BD_TARGET + "." + SCHEMA_TARGET + "." + TARGET_NAME;

        // This section is for performance issue while charging the BDV only
        var SQL_LOADED_DATE =   " ";
        if (SCHEMA_TARGET == "BDV"+SCHEMA_ENV ) {  
           // Verify if the tag LAST_EXTRACT_DATE exist on the target table : count(*)= 0 means that the tag doesn't exist
           var sql_command = "select count(*) "+
                             " from " + DWH_TOOLS_SCHEMA + "ETL_CONTROL "+
                              "WHERE JOB_NAME = '" + Target_definition + "' AND PARAM_NAME = 'LAST_EXTRACT_DATE'"  ;
           var objSqlCmd = {sqlText: sql_command};
           var objStmt  = snowflake.createStatement(objSqlCmd);  
           var objRs    = objStmt.execute();  
           while (objRs.next()){number_tag_found = objRs.getColumnValue(1);
                               };
           if (number_tag_found == 0) {
              // if tag does not exist on target, create it !
                  var sql_command = "INSERT INTO " + DWH_TOOLS_SCHEMA + "ETL_CONTROL (JOB_NAME,PARAM_NAME,PARAM_VALUE) "+ 
                                    "VALUES ('"+Target_definition+"','LAST_EXTRACT_DATE',NULL)";
                  var objSqlCmd = {sqlText: sql_command};
                  var objStmt  = snowflake.createStatement(objSqlCmd);  
                  var objRs    = objStmt.execute();  
                  while (objRs.next()){v_vc_result = objRs.getColumnValue(1);
                                      };
           } 
           // Get LAST_EXTRACT_DATE 
           var sql_command = "SELECT LAST_EXTRACT_DATE " +
                             "  FROM (select CASE WHEN NVL(PARAM_VALUE,'') = '' THEN '1900-01-01 00:00:00.000 -0400' ELSE PARAM_VALUE END AS LAST_EXTRACT_DATE "+
                             "          from " + DWH_TOOLS_SCHEMA + "ETL_CONTROL "+
                             "         WHERE PARAM_NAME = 'LAST_EXTRACT_DATE' AND JOB_NAME = '" + Target_definition + "') ED " ;                                                         
           var objSqlCmd = {sqlText: sql_command};
           var objStmt  = snowflake.createStatement(objSqlCmd);  
           var objRs    = objStmt.execute();  
           while (objRs.next()){VC_LAST_EXTRACT_DATE = objRs.getColumnValue(1);
                               };

           var SQL_LOADED_DATE =   " AND S.MD_LOADED_DT >= TO_TIMESTAMP('"+ VC_LAST_EXTRACT_DATE +"') ";
        }  //end of BDV

         // Obtenir les informationsn (TAGs) de la cible ainsi que des operations a réaliser
        // maintenant les TAGs sont dans la table ETL_CONTROL
        var sql_command = "SELECT SOURCE_NAME                                                                                           " +
                         "       ,BUSINESS_KEY                                                                                          " +
                         "       ,LOAD_TYPE                                                                                             " +
                         "       ,BD_SOURCE_NAME                                                                                        " +
                         "       ,to_char(date_trunc('hour',current_timestamp()), 'YYYY-MM-DD HH24:MI:SS.FF3 TZHTZM') AS CURRENT_TS     " +
                         "   FROM " + DWH_TOOLS_SCHEMA + "V_TAGS A                                                                 " +
                         "  WHERE A.JOB_NAME = '" + Target_definition + "'  ";

        var objSqlCmd = {sqlText: sql_command};
        var objStmt  = snowflake.createStatement(objSqlCmd);  
        var objRs    = objStmt.execute();  

        var VC_LOAD_TYPE = "";
        while (objRs.next()){SOURCE_NAME          = objRs.getColumnValue(1);
                             BUSINESS_KEY         = objRs.getColumnValue(2);
                             VC_LOAD_TYPE         = objRs.getColumnValue(3);
                             BD_SOURCE_NAME       = objRs.getColumnValue(4);
                             VC_CURRENT_TIMESTAMP = objRs.getColumnValue(5);
                             };
        // validation de présence des TAGs
        if ((VC_LOAD_TYPE == "") || (SOURCE_NAME  == "") || (BUSINESS_KEY  == "") || (BD_SOURCE_NAME  == "")) {  
            pre_json = pre_json + '1 or more TAGs/param are missing from ETL_CONTROL table "}}'  ;
            GLOBAL_SQL_COMMAND = '{'+GLOBAL_SQL_COMMAND.replace(/'/g, "\\''")+ pre_json.replace(/'/g, "\\''") +'}'; 
            var sql_textJson = '[{' + JSON_HEADER + GLOBAL_SQL_COMMAND + '}]';
            var sql_command = "CALL "+DWH_TOOLS_SCHEMA+"USP_LOGGING('"+Target_definition+"','"+AUDIT_ID+"','Log','Failure','"+FILENAME+"',TO_TIMESTAMP_NTZ ('" + FILEDATE + "'),'"+JSON_HEADER+GLOBAL_SQL_COMMAND+"',NULL)"; 
            var objSqlCmd = {sqlText: sql_command};
            var objStmt  = snowflake.createStatement(objSqlCmd);  
            var objRs    = objStmt.execute();  

            return "Failed (" + Target_definition + ") : 1 or more TAGs/param are missing from ETL_CONTROL table" ;
        } // END IF OF VALIDATION OF COLUMN SOURCE

        // SET VARIABLE FOR ALL DATA MANIPULATION
        var VC_TRUNCATE_INDICATOR = (VC_LOAD_TYPE.indexOf("T") != -1 ) ? "TRUE" : "FALSE";
        var VC_DELETE_INDICATOR  = (VC_LOAD_TYPE.indexOf("D") != -1 ) ? "TRUE" : "FALSE";
        var VC_UPDATE_INDICATOR  = (VC_LOAD_TYPE.indexOf("U") != -1 ) ? "TRUE" : "FALSE";
        var VC_INSERT_INDICATOR  = (VC_LOAD_TYPE.indexOf("I") != -1 ) ? "TRUE" : "FALSE";
        
        // Suffix name, used to determine de HK_HUB name of the vue
        var Suffix_name = TARGET_NAME.substr(TARGET_NAME.indexOf("_")+1,99999);
        
        // Source object complete name
        var Source_definition =  BD_SOURCE_NAME + '.' + SOURCE_NAME;

// VALIDATE IF ALL TARGET COLUMN ARE IN VIEW
        var sql_command = "SELECT listagg(COLUMN_NAME,';') within group (ORDER BY COLUMN_NAME ASC )  MISSING_COLUMN_NAME   " +
                          "  FROM (SELECT COLUMN_NAME " +
                          "          FROM " + BD_TARGET + ".INFORMATION_SCHEMA.COLUMNS  TD " +
                          "         WHERE TD.TABLE_CATALOG||'.'||TD.TABLE_SCHEMA||'.'||TD.TABLE_NAME = '"+Target_definition+"' " +
                          "           AND TD.COLUMN_NAME NOT IN ('HK_HUB','MD_CREATION_AUDIT_ID','MD_IS_DELETED','MD_FILENAME','MD_FILEDATE','MD_MODIFY_AUDIT_ID','MD_MODIFY_DT','MD_CREATION_DT','MD_START_DT','MD_END_DT')  "+
                          "       minus  "+
                          "       (SELECT COLUMN_NAME "+
                          "          from " + BD_SOURCE_NAME + ".INFORMATION_SCHEMA.COLUMNS  TS  " +
                          "         WHERE TS.TABLE_CATALOG||'.'||TS.TABLE_SCHEMA||'.'||TS.TABLE_NAME = '"+Source_definition+"' "+
                          "       )) " ;

        var objSqlCmd = {sqlText: sql_command};
        var objStmt  = snowflake.createStatement(objSqlCmd);  
        var objRs    = objStmt.execute();  
        while (objRs.next()){MISSING_COLUMN_NAME     = objRs.getColumnValue(1);
                             };
        if (MISSING_COLUMN_NAME != "") {  
            pre_json = pre_json + '1 or more columns are missing from source : ' + MISSING_COLUMN_NAME + '"}}'  ;
            GLOBAL_SQL_COMMAND = '{'+GLOBAL_SQL_COMMAND.replace(/'/g, "\\''")+ pre_json.replace(/'/g, "\\''") +'}'; 
            var sql_textJson = '[{' + JSON_HEADER + GLOBAL_SQL_COMMAND + '}]';
            var sql_command = "CALL "+DWH_TOOLS_SCHEMA+"USP_LOGGING('"+Target_definition+"','"+AUDIT_ID+"','Log','Failure','"+FILENAME+"',TO_TIMESTAMP_NTZ ('" + FILEDATE + "'),'"+JSON_HEADER+GLOBAL_SQL_COMMAND+"',NULL)"; 
            var objSqlCmd = {sqlText: sql_command};
            var objStmt  = snowflake.createStatement(objSqlCmd);  
            var objRs    = objStmt.execute();  

            return "Failed (" + Target_definition + ") : 1 or more columns are missing from source : " + MISSING_COLUMN_NAME ;
        } // END IF OF VALIDATION OF COLUMN SOURCE

        //début trouver la PK
        var sql_command = "show primary keys in table " + Target_definition ;
        var objSqlCmd = {sqlText: sql_command};
        var objStmt  = snowflake.createStatement(objSqlCmd);  
        var objRs    = objStmt.execute();  
        while (objRs.next()){ls_col_name     = objRs.getColumnValue(5);
                              if (ls_col_name.substr(0,6) == "HK_HUB" ) {  
                                  var pk_col_name = ls_col_name
                               }    
                            }
        // fin trouver la PK                  

        // Création de l'enregistrement dans JOB_EXECUTION
        var sql_command = "CALL " + DWH_TOOLS_SCHEMA + "USP_LOGGING('" + Target_definition + "','" + 
                                       AUDIT_ID + "', 'Start', NULL, '" + FILENAME + "',TO_TIMESTAMP_NTZ ('" + FILEDATE + "'), NULL, NULL)";
        var objSqlCmd = {sqlText: sql_command};
        var objStmt  = snowflake.createStatement(objSqlCmd);  
        var objRs    = objStmt.execute();  
           
            // Obtenir les informations de la correspondance source et cible 
            var sql_command = "SELECT 'S.'||listagg(TS.COLUMN_NAME, ',S.') within group (ORDER BY lpad(TD.ORDINAL_POSITION, 5, '0') ASC ) LIST_COLUMN_SRC "+
                              "      ,listagg(TD.COLUMN_NAME, ',')         within group (ORDER BY lpad(TD.ORDINAL_POSITION, 5, '0') ASC ) LIST_COLUMN_CIB "+
                              "  FROM "+BD_TARGET+".INFORMATION_SCHEMA.COLUMNS  TD , "+
                              "       "+BD_SOURCE_NAME+".INFORMATION_SCHEMA.COLUMNS  TS  "+
                              " WHERE TD.TABLE_CATALOG||'.'||TD.TABLE_SCHEMA||'.'||TD.TABLE_NAME = '"+Target_definition+"' "+
                              "   AND TS.TABLE_CATALOG||'.'||TS.TABLE_SCHEMA||'.'||TS.TABLE_NAME = '"+Source_definition+"' "+
                              "   AND ts.column_name not in ('HK_HUB','MD_CREATION_AUDIT_ID','MD_IS_DELETED','MD_FILENAME','MD_FILEDATE','MD_MODIFY_AUDIT_ID','MD_MODIFY_DT','MD_CREATION_DT','MD_START_DT','MD_END_DT')  "+
                              "   and (TD.COLUMN_NAME = TS.COLUMN_NAME or (TD.COLUMN_NAME = '"+pk_col_name+"' and TS.COLUMN_NAME = '"+pk_col_name+"'))"
            var objSqlCmd = {sqlText: sql_command};
            var objStmt  = snowflake.createStatement(objSqlCmd);  
            var objRs    = objStmt.execute();  
            while (objRs.next()){VC_LIST_COLUMN_SRC      = objRs.getColumnValue(1);
                                 VC_LIST_COLUMN_CIB      = objRs.getColumnValue(2);
                                };
        // GET ALL COLUMN LIST OF THE TARGET TABLE
        var sql_command = "SELECT ','||listagg(TD.COLUMN_NAME, ',')||',' "+
                          "  FROM "+BD_TARGET+".INFORMATION_SCHEMA.COLUMNS AS TD  " +
                          "WHERE TD.TABLE_CATALOG||'.'||TD.TABLE_SCHEMA||'.'||TD.TABLE_NAME = '"+Target_definition+"'";

        pre_json = '"Erreur de pilotage": {"1-SQL": "'+sql_command+'","2-Result": "';
        var objSqlCmd = {sqlText: sql_command};
        var objStmt  = snowflake.createStatement(objSqlCmd);  
        var objRs    = objStmt.execute();  
        while (objRs.next()){VC_LIST_OF_TARGET_COLUMN = objRs.getColumnValue(1);
                            };
        pre_json = '';
        // VERIFY IF MD_START_DT COLUMN IS PRESENT, TO ADAPTE SQL IS SO
        var IS_START_DT_TARGET_COLUMN = "";
        var IS_START_DT_PARTITION    = "MD_CREATION_DT";
        var IS_START_DT_CONDITION    = " AND T.MD_CREATION_DT = S.MD_CREATION_DT "
        var IS_START_DT_COLUMN       = "";
        var IS_START_DT_VALUE        = "";
        var IS_START_DT_UPDATE_SQL   = "";
        if (VC_LIST_OF_TARGET_COLUMN.indexOf(",MD_START_DT,") != -1) {  
            IS_START_DT_TARGET_COLUMN = ", T.MD_START_DT";
            IS_START_DT_PARTITION    = "MD_START_DT";
            IS_START_DT_CONDITION    = " AND T.MD_START_DT = S.MD_START_DT "
            IS_START_DT_COLUMN       = ",MD_START_DT";
            IS_START_DT_VALUE        = ",TO_TIMESTAMP_NTZ ('" + FILEDATE + "')"
            IS_START_DT_UPDATE_SQL   = ",MD_START_DT = TO_TIMESTAMP_NTZ ('" + FILEDATE + "')";
        } // END IF OF CHECK MD_START_DT
            
        // VERIFY IF MD_IS_DELETED COLUMN IS PRESENT, TO ADAPTE SQL IS SO
        var IS_DELETED_TARGET_COLUMN = "";
        var IS_DELETED_CONDITION    = "";
        var IS_DELETED_COLUMN       = "";
        var IS_DELETED_UPDATE_SQL   = "";
        if (VC_LIST_OF_TARGET_COLUMN.indexOf(",MD_IS_DELETED,") != -1) {  
            IS_DELETED_TARGET_COLUMN = ",T.MD_IS_DELETED";
            IS_DELETED_CONDITION    = " AND NVL(MD_IS_DELETED,0) = 0 ";
            IS_DELETED_COLUMN       = ",MD_IS_DELETED";
            IS_DELETED_UPDATE_SQL   = ",MD_IS_DELETED = 0";
        } // END IF OF CHECK MD_IS_DELETED

        // VERIFY IF MD_MODIFY_AUDIT_ID COLUMN IS PRESENT, TO ADAPTE SQL IS SO
        var IS_MD_MODIFY_AUDIT_ID_COLUMN       = "";
        var IS_MD_MODIFY_AUDIT_ID_UPDATE_SQL   = "";
		var IS_MD_MODIFY_AUDIT_ID_VALUE        = "";
        if (VC_LIST_OF_TARGET_COLUMN.indexOf(",MD_MODIFY_AUDIT_ID,") != -1) {  
            IS_MD_MODIFY_AUDIT_ID_COLUMN       = ",MD_MODIFY_AUDIT_ID";
            IS_MD_MODIFY_AUDIT_ID_UPDATE_SQL   = ",MD_MODIFY_AUDIT_ID = '" + AUDIT_ID + "'";
			IS_MD_MODIFY_AUDIT_ID_VALUE        = ",'"+ AUDIT_ID + "'";
        } // END IF OF CHECK MD_MODIFY_AUDIT_ID

        // VERIFY IF MD_MODIFY_DT COLUMN IS PRESENT, TO ADAPTE SQL IS SO
        var IS_MD_MODIFY_DT_COLUMN       = "";
        var IS_MD_MODIFY_DT_UPDATE_SQL   = "";
        if (VC_LIST_OF_TARGET_COLUMN.indexOf(",MD_MODIFY_AUDIT_ID,") != -1) {  
            IS_MD_MODIFY_DT_COLUMN       = ",MD_MODIFY_AUDIT_ID";
            IS_MD_MODIFY_DT_UPDATE_SQL   = ",MD_MODIFY_DT = CURRENT_TIMESTAMP()";
        } // END IF OF CHECK MD_MODIFY_AUDIT_ID

        // VERIFY IF MD_FILENAME COLUMN IS PRESENT, TO ADAPTE SQL IS SO
        var IS_MD_FILENAME_COLUMN       = "";
        var IS_MD_FILENAME_UPDATE_SQL   = "";
		var IS_MD_FILENAME_VALUE        = "";
        if (VC_LIST_OF_TARGET_COLUMN.indexOf(",MD_FILENAME,") != -1) {  
            IS_MD_FILENAME_COLUMN       = ",MD_FILENAME";
            IS_MD_FILENAME_UPDATE_SQL   = ",MD_FILENAME = '" + FILENAME + "'";
			IS_MD_FILENAME_VALUE        = ",'" + FILENAME + "'";
        } // END IF OF CHECK MD_FILENAME

        // VERIFY IF MD_FILEDATE COLUMN IS PRESENT, TO ADAPTE SQL IS SO
        var IS_MD_FILEDATE_COLUMN       = "";
        var IS_MD_FILEDATE_UPDATE_SQL   = "";
		var IS_MD_FILEDATE_VALUE        = "";
        if (VC_LIST_OF_TARGET_COLUMN.indexOf(",MD_FILEDATE,") != -1) {  
            IS_MD_FILEDATE_COLUMN       = ",MD_FILEDATE";
            IS_MD_FILEDATE_UPDATE_SQL   = ",MD_FILEDATE = TO_TIMESTAMP_NTZ ('" + FILEDATE + "')";
			IS_MD_FILEDATE_VALUE        = ",TO_TIMESTAMP_NTZ ('" + FILEDATE + "')";
        } // END IF OF CHECK MD_FILEDATE

            // PRÉPARATION DU SQL_OUTPUT
            JSON_HEADER = '"1-System_Name" : "'+SYSTEM_NAME+'","2-Environment" : "'+DATABASE_ENV+'","3-Object" : "'+Target_definition+'","4-Source" : "'+Source_definition+'","5-Load_type" : "'+VC_LOAD_TYPE+'", "6-SQLs" : {';
        
            // TRUNQUER LA CIBLE SI L'INDICATEUR DE TRUNCATE est a TRUE
            if (VC_TRUNCATE_INDICATOR === 'TRUE') {  
                var SQL_STMT = "TRUNCATE TABLE " + Target_definition;
                SQL_COUNT = SQL_COUNT +1;
                pre_json = '"SQL command'+SQL_COUNT+'": {"1-SQL": "'+SQL_STMT.replace(/'/g, "\\\\'") +'","2-Result": "';
                
                stmt = snowflake.createStatement({sqlText : SQL_STMT})
                var result = stmt.execute();
                var QUERYID  = stmt.getQueryId();

                GLOBAL_SQL_COMMAND = GLOBAL_SQL_COMMAND + '"SQL command'+SQL_COUNT+'": {"1-SQL": "'+SQL_STMT +
                                                                                     '","2-QueryId" : "'+ QUERYID +
                                                                                     '","3-Result": {"insert": "'+stmt.getNumRowsInserted()   +
                                                                                                  '","update": "'+objStmt.getNumRowsUpdated() +
                                                                                                  '","delete": "'+objStmt.getNumRowsDeleted() +
                                                                                                  '","affected": "'+stmt.getNumRowsAffected() +
                                                                                                  '"}},';
            } // END IF DU TRUNCATE

        // GET BUSINESS KEY LIST
        var sql_command = "SELECT replace('NVL(TO_CHAR(T.'||listagg(TD.COLUMN_NAME||'),''##NULL##'')=NVL(TO_CHAR(S.'||TD.COLUMN_NAME||'),''##NULL##'') AND NVL(TO_CHAR(T.') within group (ORDER BY lpad(TD.ORDINAL_POSITION, 5, '0') ASC )||'##fin##','AND NVL(TO_CHAR(T.##fin##','') KEY_LIST_CONDITION "+
                          "       ,listagg(TD.COLUMN_NAME, ',') within group (ORDER BY lpad(TD.ORDINAL_POSITION, 5, '0') ASC ) KEY_LIST " +
                          "  FROM "+BD_TARGET+".INFORMATION_SCHEMA.COLUMNS AS TD " +
                          " WHERE TD.TABLE_CATALOG||'.'||TD.TABLE_SCHEMA||'.'||TD.TABLE_NAME = '"+Target_definition+"' "+
                          "   AND COLUMN_NAME       in ('"+BUSINESS_KEY.replace(/,/g, "','")+"')";  
        pre_json = '"Erreur de pilotage": {"1-SQL": "'+sql_command+'","2-Result": "';
        var objSqlCmd = {sqlText: sql_command};
        var objStmt  = snowflake.createStatement(objSqlCmd);  
        var objRs    = objStmt.execute();  
        while (objRs.next()){VC_KEY_LIST_CONDITION = objRs.getColumnValue(1);
                             VC_KEY_LIST          = objRs.getColumnValue(2);
                               };
        pre_json = '';
         
        // GET NON BUSINESS KEY LIST
        var sql_command = "SELECT 'T.'||listagg(TD.COLUMN_NAME||'='||'S.'||TS.COLUMN_NAME,', T.') within group (ORDER BY lpad(TD.ORDINAL_POSITION, 5, '0') ASC ) NON_KEY_LIST   "+
                          "  FROM "+BD_TARGET+".INFORMATION_SCHEMA.COLUMNS AS TD  " +
                          "      ,"+BD_SOURCE_NAME+".INFORMATION_SCHEMA.COLUMNS AS TS  " +
                          "WHERE TD.TABLE_CATALOG||'.'||TD.TABLE_SCHEMA||'.'||TD.TABLE_NAME = '"+Target_definition+"'    " +
                          " AND  TS.TABLE_CATALOG||'.'||TS.TABLE_SCHEMA||'.'||TS.TABLE_NAME = '"+Source_definition+"'    " +
                          "AND TD.COLUMN_NAME NOT IN ('MD_CREATION_AUDIT_ID','MD_FILENAME', 'MD_FILEDATE','MD_MODIFY_AUDIT_ID','MD_MODIFY_DT','MD_CREATION_DT','MD_HASHDIFF','MD_START_DT','MD_END_DT')   " +
                          "AND TD.COLUMN_NAME NOT IN ('"+BUSINESS_KEY.replace(/,/g, "','")+"') " +
                          "AND (TD.COLUMN_NAME = TS.COLUMN_NAME OR (TD.COLUMN_NAME = '"+pk_col_name+"' AND TS.COLUMN_NAME = '"+pk_col_name+"'))";

        pre_json = '"Erreur de pilotage": {"1-SQL": "'+sql_command+'","2-Result": "';
        var objSqlCmd = {sqlText: sql_command};
        var objStmt  = snowflake.createStatement(objSqlCmd);  
        var objRs    = objStmt.execute();  
        while (objRs.next()){VC_NON_KEY_LIST = objRs.getColumnValue(1);
                               };
        pre_json = '';
        // VERIFY IF FILE NAME IS NOT NULL, ADD FILE NAME TO PROCESS IF REQUIRED 
        var VC_FILE_INFO = "";
        if (FILENAME  !== undefined && FILENAME != "" ) {   
            var VC_FILE_INFO = ` AND s.MD_FILENAME_RAW = '` + FILENAME + `'`;
           }; // END IF FILE INFO


           if (VC_INSERT_INDICATOR == "TRUE") {  
             ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
             // TRAITEMENT POUR INSÉRER LES DONNÉES SEULEMENT  
             ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
              var sql_command = " INSERT INTO " + Target_definition + 
                                                " (" + VC_LIST_COLUMN_CIB + ",MD_CREATION_AUDIT_ID" + IS_START_DT_COLUMN + IS_MD_MODIFY_AUDIT_ID_COLUMN + IS_MD_FILENAME_COLUMN + IS_MD_FILEDATE_COLUMN + ")" +
                                "  SELECT DISTINCT " + VC_LIST_COLUMN_SRC + ",'" + AUDIT_ID + "'" + IS_START_DT_VALUE  + IS_MD_MODIFY_AUDIT_ID_VALUE  + IS_MD_FILENAME_VALUE  + IS_MD_FILEDATE_VALUE +
                                "    FROM " + Source_definition + " as s " +
                                " left join (SELECT "+pk_col_name+" " + IS_DELETED_COLUMN + 
                                            " FROM " + Target_definition + 
                                           ") AS T " +
                                         " ON T."+pk_col_name+" =S."+pk_col_name+
                                " WHERE T."+pk_col_name+" IS NULL "+ IS_DELETED_CONDITION + VC_FILE_INFO ;
               SQL_COUNT = SQL_COUNT +1;
               pre_json = '"SQL command'+SQL_COUNT+'": {"1-SQL": "'+sql_command+'","2-Result": "';     
               var objSqlCmd = {sqlText: sql_command};
               var objStmt  = snowflake.createStatement(objSqlCmd);  
               var objRs    = objStmt.execute();  
               var QUERYID  = objStmt.getQueryId();
               pre_json = '';
            GLOBAL_SQL_COMMAND = GLOBAL_SQL_COMMAND + '"SQL command'+SQL_COUNT+'": {"1-SQL": "'+sql_command +
                                                                                 '","2-QueryId" : "'+ QUERYID +
                                                                                 '","3-Result": {"insert": "'+objStmt.getNumRowsInserted()  +
                                                                                              '","update": "'+objStmt.getNumRowsUpdated()   +
                                                                                              '","delete": "'+objStmt.getNumRowsDeleted()   +
                                                                                              '","affected": "'+objStmt.getNumRowsAffected()+
                                                                                              '"}},';
           
           } ;

           if (  VC_TRUNCATE_INDICATOR == "FALSE" 
              && VC_INSERT_INDICATOR == "FALSE" 
               ) {   
             // LOG  TYPE DE CHARGEMENT NON PRIS EN CHARGE
             var sql_command = "ERROR ; TYPE DE CHARGEMENT NON PRISE EN CHARGE, CHANGER LA VALEUR DE LOAD_TYPE DU TAG DE LA TABLE ";
             var sql_command = "CALL " + DWH_TOOLS_SCHEMA + "USP_LOGGING('"+Target_definition+"', '"+AUDIT_ID+"', 'LOG', 'Failure', NULL, NULL, '" + sql_command.replace(/'/g, "\\\\'") + "',NULL)";
             result = snowflake.execute({sqlText : sql_command});
            } // END IF DU TYPE DE CHARGEMENT
        
        // Update tag for next Extract_date
        if (SCHEMA_TARGET.substring(0, 3) == "BDV" ) {            
         var sql_command = "UPDATE " + DWH_TOOLS_SCHEMA + "ETL_CONTROL " + 
                           "   SET PARAM_VALUE = '"+VC_CURRENT_TIMESTAMP+"' " +
                           "      ,MD_LAST_UPDATE_USER = current_user() " +
                           "      ,MD_LAST_UPDATE_DT  = current_timestamp() " +
                           " WHERE PARAM_NAME = 'LAST_EXTRACT_DATE' AND JOB_NAME = '" + Target_definition + "'"; 
         var objSqlCmd = {sqlText: sql_command};
         var objStmt  = snowflake.createStatement(objSqlCmd);  
         var objRs    = objStmt.execute();  
        }


        
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // fermeture de job log
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        GLOBAL_SQL_COMMAND = GLOBAL_SQL_COMMAND.replace(/'/g, "''''");           // Multiplie les 'quote' pour le format requis pour le INSERT final
        GLOBAL_SQL_COMMAND = GLOBAL_SQL_COMMAND.replace(/\\n/g, "");             // Change le caractère de fin de ligne dans les chaines JSON pour faciliter la lecture des logs
        var sql_textJson = '[{' + JSON_HEADER + GLOBAL_SQL_COMMAND + '}}]';



        var sql_command = `
		    CALL $${DWH_TOOLS_SCHEMA}USP_LOGGING('$${Target_definition}','$${AUDIT_ID}', 'Stop', 'Success', '$${FILENAME}', TO_TIMESTAMP_NTZ('$${FILEDATE}'), NULL, '$${sql_textJson}')            
            `; 

        var objSqlCmd = {sqlText: sql_command};
        var objStmt = snowflake.createStatement(objSqlCmd);  
        var objRs   = objStmt.execute();  

    } // try
    
    catch(err) {
        // Fermeture de l'enregistrement dans JOB_EXECUTION
        // Formatte la chaine SQL du message à inscrire pour qu'il soit compatible dans le Insert
        pre_json = pre_json + err.message + '"}}'  ;
        //GLOBAL_SQL_COMMAND = '{'+GLOBAL_SQL_COMMAND.replace(/'/g, "''''")+ pre_json.replace(/'/g, "''''") +'}'; 
        //GLOBAL_SQL_COMMAND = GLOBAL_SQL_COMMAND.replace(/\\n/g, "");             // Change le caractère de fin de ligne dans les chaines JSON pour faciliter la lecture des logs

        // Concaténation du Header, de la valeur de requête GLOBAL_SQL_COMMAND telle qu'elle existe au moment de l'erreur, 
        // et du message d'erreur qu'on formatte pour être compatible avec le INSERT final dans log
        var sql_textJson = '[{' + JSON_HEADER + GLOBAL_SQL_COMMAND + pre_json.replace(/'/g, "''''") + '}]';

        var sql_command = `
            CALL $${DWH_TOOLS_SCHEMA}USP_LOGGING('$${Target_definition}','$${AUDIT_ID}', 'Stop', 'Failure', NULL,NULL,'$${sql_textJson}', NULL)
            `; 

        
        var objSqlCmd = {sqlText: sql_command};
        var objStmt = snowflake.createStatement(objSqlCmd);  
        var objRs   = objStmt.execute();  

        return "Failed (" + Target_definition + ") : " + err.message + " SQL : " + JSON_HEADER + GLOBAL_SQL_COMMAND;
       }
   return "done";
;
EOT
}
