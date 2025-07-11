-- Sample Snowflake DDL for testing the extension
-- Copy this content to test the converter

-- Simple table
CREATE TABLE users (
    id NUMBER(38,0) NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Table with schema
CREATE OR REPLACE TABLE sales.products (
    product_id NUMBER(38,0) NOT NULL COMMENT 'Unique product identifier',
    product_name VARCHAR(200) NOT NULL COMMENT 'Product display name',
    category VARCHAR(100),
    price NUMBER(10,2) DEFAULT 0.00,
    description TEXT
) COMMENT 'Product catalog table';

-- Secure view
CREATE SECURE VIEW active_users AS
SELECT id, username, email, created_at
FROM users
WHERE is_active = TRUE;

-- Stored procedure
CREATE PROCEDURE update_user_status(
    user_id NUMBER,
    new_status BOOLEAN DEFAULT TRUE
)
RETURNS STRING
LANGUAGE SQL
COMMENT 'Updates user status'
AS
BEGIN
    UPDATE users SET is_active = new_status WHERE id = user_id;
    RETURN 'User status updated successfully';
END;
