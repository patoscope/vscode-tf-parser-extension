-- Integration Test: Comprehensive Snowflake DDL to Terraform Conversion
-- This file demonstrates all supported features of the extension

-- ===== TABLES =====

-- Simple table
CREATE TABLE users (
    id NUMBER(38,0) NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Table with schema and database
CREATE OR REPLACE TABLE sales.products (
    product_id NUMBER(38,0) NOT NULL COMMENT 'Unique product identifier',
    product_name VARCHAR(200) NOT NULL COMMENT 'Product display name',
    category VARCHAR(100),
    price NUMBER(10,2) DEFAULT 0.00,
    inventory_count INT DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
) COMMENT 'Product catalog table';

-- Table with clustering
CREATE TABLE analytics.user_events (
    event_date DATE NOT NULL,
    user_id NUMBER(38,0) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    properties VARIANT,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
) CLUSTER BY (event_date, user_id)
COMMENT 'User activity events for analytics';

-- ===== VIEWS =====

-- Simple view
CREATE VIEW active_users AS
SELECT id, username, email, created_at
FROM users
WHERE is_active = TRUE;

-- Secure view with schema
CREATE OR REPLACE SECURE VIEW reporting.sales_summary AS
SELECT 
    p.category,
    COUNT(*) as product_count,
    AVG(p.price) as avg_price,
    SUM(p.inventory_count) as total_inventory
FROM sales.products p
GROUP BY p.category
ORDER BY product_count DESC;

-- ===== STORED PROCEDURES =====

-- Simple procedure
CREATE PROCEDURE update_user_status(user_id NUMBER, new_status BOOLEAN)
RETURNS STRING
LANGUAGE SQL
AS
BEGIN
    UPDATE users SET is_active = new_status WHERE id = user_id;
    RETURN 'User status updated successfully';
END;

-- Complex procedure with default values
CREATE OR REPLACE PROCEDURE admin.bulk_update_products(
    category_filter VARCHAR DEFAULT 'electronics',
    price_multiplier NUMBER DEFAULT 1.1,
    update_timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
RETURNS TABLE (product_id NUMBER, old_price NUMBER, new_price NUMBER)
LANGUAGE SQL
COMMENT 'Bulk update product prices by category'
AS
$$
DECLARE
    updated_count NUMBER DEFAULT 0;
    result_cursor CURSOR FOR 
        SELECT product_id, price, price * price_multiplier as new_price
        FROM sales.products 
        WHERE category = category_filter;
BEGIN
    FOR record IN result_cursor DO
        UPDATE sales.products 
        SET price = record.new_price, 
            modified_at = update_timestamp
        WHERE product_id = record.product_id;
        
        updated_count := updated_count + 1;
    END FOR;
    
    RETURN TABLE(
        SELECT product_id, price as old_price, price * price_multiplier as new_price
        FROM sales.products 
        WHERE category = category_filter
    );
END;
$$;

-- ===== ADVANCED FEATURES =====

-- Table with complex data types
CREATE TABLE data_warehouse.fact_sales (
    sale_id NUMBER(38,0) NOT NULL,
    customer_data OBJECT,
    sale_items ARRAY,
    metadata VARIANT,
    geo_location GEOGRAPHY,
    sale_timestamp TIMESTAMP_TZ,
    partition_date DATE
) CLUSTER BY (partition_date, customer_data:"customer_id")
COMMENT 'Sales fact table with complex data types';

-- View with complex query
CREATE VIEW analytics.customer_insights AS
SELECT 
    c.customer_id,
    c.customer_name,
    ARRAY_AGG(DISTINCT p.category) as purchased_categories,
    COUNT(DISTINCT fs.sale_id) as total_orders,
    SUM(fs.sale_items[0]:amount::NUMBER) as total_spent,
    MAX(fs.sale_timestamp) as last_purchase_date
FROM customers c
JOIN data_warehouse.fact_sales fs ON c.customer_id = fs.customer_data:"customer_id"::NUMBER
JOIN sales.products p ON p.product_id = fs.sale_items[0]:product_id::NUMBER
WHERE fs.sale_timestamp >= DATEADD(year, -1, CURRENT_TIMESTAMP())
GROUP BY c.customer_id, c.customer_name
HAVING total_orders >= 5
ORDER BY total_spent DESC;
