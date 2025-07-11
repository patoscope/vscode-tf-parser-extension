-- Sample Snowflake DDL for testing the extension
-- This file contains examples of tables, views, and stored procedures

-- Create a simple table
CREATE OR REPLACE TABLE my_database.my_schema.customers (
    customer_id NUMBER(38,0) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP_NTZ(9) DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ(9),
    is_active BOOLEAN DEFAULT TRUE,
    metadata VARIANT
    COMMENT 'Customer information table'
) COMMENT = 'Main customer table for the application';

-- Create a view
CREATE OR REPLACE SECURE VIEW my_database.my_schema.active_customers AS
SELECT 
    customer_id,
    first_name,
    last_name,
    email,
    created_at
FROM my_database.my_schema.customers 
WHERE is_active = TRUE
COMMENT = 'View showing only active customers';

-- Create another table with clustering
CREATE OR REPLACE TABLE my_database.my_schema.orders (
    order_id NUMBER(38,0) NOT NULL,
    customer_id NUMBER(38,0) NOT NULL,
    order_date DATE NOT NULL,
    total_amount DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'PENDING',
    notes TEXT
) CLUSTER BY (order_date, customer_id)
COMMENT = 'Orders table with date clustering';

-- Create a stored procedure
CREATE OR REPLACE PROCEDURE my_database.my_schema.update_customer_status(
    customer_id_param NUMBER,
    new_status BOOLEAN DEFAULT TRUE
)
RETURNS STRING
LANGUAGE SQL
COMMENT = 'Updates customer active status'
AS
$$
BEGIN
    UPDATE my_database.my_schema.customers 
    SET is_active = new_status,
        updated_at = CURRENT_TIMESTAMP()
    WHERE customer_id = customer_id_param;
    
    RETURN 'Customer status updated successfully';
END;
$$;

-- Create a simple view without schema qualification
CREATE VIEW customer_summary AS
SELECT 
    COUNT(*) as total_customers,
    COUNT(CASE WHEN is_active THEN 1 END) as active_customers,
    COUNT(CASE WHEN NOT is_active THEN 1 END) as inactive_customers
FROM customers;
