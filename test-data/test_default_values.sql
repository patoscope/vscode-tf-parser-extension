-- Test file for default value bug fix
-- This reproduces the exact issue mentioned in the bug report

CREATE TABLE test_default_values (
    id NUMBER(38,0) NOT NULL,
    MD_IS_DELETED NUMBER(1) NOT NULL DEFAULT 0 COMMENT 'Indique si la ligne est soft-supprimée ou non',
    MD_CREATION_DT TIMESTAMP_NTZ(9) NOT NULL DEFAULT CURRENT_TIMESTAMP() COMMENT 'DATE ET HEURE INSERE',
    status VARCHAR(50) DEFAULT 'active',
    flag BOOLEAN DEFAULT TRUE
);
