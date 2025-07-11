-- Test SQL to demonstrate Azure DevOps pipeline pattern
-- This represents the exact example you provided

CREATE OR REPLACE TABLE DB_CDI_DEV_DWH.RDV_SANDBOX.SAT_SUREX_SOURCE_CONTRACT (
    id NUMBER(38,0) NOT NULL COMMENT 'Unique identifier',
    contract_number VARCHAR(100) NOT NULL COMMENT 'Contract reference number',
    source_system VARCHAR(50) NOT NULL COMMENT 'Source system identifier',
    load_date TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP() COMMENT 'Data load timestamp',
    hash_diff VARCHAR(32) NOT NULL COMMENT 'Hash of non-key attributes'
) COMMENT 'Satellite table for contract source data';

CREATE OR REPLACE VIEW DB_CDI_DEV_DWH.RDV_SANDBOX.V_ACTIVE_CONTRACTS AS
SELECT 
    id,
    contract_number,
    source_system,
    load_date
FROM DB_CDI_DEV_DWH.RDV_SANDBOX.SAT_SUREX_SOURCE_CONTRACT
WHERE hash_diff IS NOT NULL;
