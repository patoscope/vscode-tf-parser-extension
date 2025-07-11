-- Test SQL with complex stored procedure containing role names and special characters
-- This reproduces the issue mentioned: "GMAR_APL_HUBANALYTIQUE_IAPC" in SP_REBUILD_SUREX_RDV

CREATE OR REPLACE PROCEDURE SP_REBUILD_SUREX_RDV()
RETURNS STRING
LANGUAGE SQL
COMMENT = 'Rebuild procedure with role switching'
AS
$$
DECLARE
    result STRING DEFAULT '';
BEGIN
    -- Use secondary roles with special characters and hyphens
    sqlText := "USE SECONDARY ROLES \"GMAR_APL_HUBANALYTIQUE_IAPC-CDI-READER_D\", \"GMAR_APL_HUBANALYTIQUE-AV-CDI_READER_D\";";
    
    -- Execute some complex operations
    EXECUTE IMMEDIATE sqlText;
    
    -- More complex SQL with special identifiers
    INSERT INTO target_table 
    SELECT 
        "FIELD-WITH-DASHES",
        "FIELD_WITH_UNDERSCORES",
        'String with "quotes" and special chars: éàü'
    FROM source_table
    WHERE "COMPLEX-FIELD" = 'value';
    
    RETURN 'Success: Procedure executed with roles: GMAR_APL_HUBANALYTIQUE_IAPC-CDI-READER_D';
EXCEPTION
    WHEN OTHER THEN
        RETURN 'Error: ' || SQLERRM;
END;
$$;
