-- Example Snowflake DDL for e-commerce database
-- This demonstrates various object types supported by the extension

-- Customer management table
CREATE OR REPLACE TABLE ecommerce.customer.customers (
    customer_id NUMBER(38,0) NOT NULL,
    customer_uuid STRING NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    date_of_birth DATE,
    registration_date TIMESTAMP_NTZ(9) DEFAULT CURRENT_TIMESTAMP(),
    last_login_date TIMESTAMP_NTZ(9),
    customer_status VARCHAR(20) DEFAULT 'ACTIVE',
    lifetime_value DECIMAL(12,2) DEFAULT 0.00,
    customer_metadata VARIANT,
    created_at TIMESTAMP_NTZ(9) DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ(9)
) CLUSTER BY (registration_date, customer_status)
COMMENT = 'Main customer information table for e-commerce platform';

-- Order management table
CREATE OR REPLACE TABLE ecommerce.orders.orders (
    order_id NUMBER(38,0) NOT NULL,
    order_uuid STRING NOT NULL,
    customer_id NUMBER(38,0) NOT NULL,
    order_date DATE NOT NULL,
    order_status VARCHAR(50) DEFAULT 'PENDING',
    total_amount DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    shipping_amount DECIMAL(12,2) DEFAULT 0.00,
    discount_amount DECIMAL(12,2) DEFAULT 0.00,
    payment_method VARCHAR(50),
    shipping_address OBJECT,
    billing_address OBJECT,
    order_notes TEXT,
    processed_at TIMESTAMP_NTZ(9),
    shipped_at TIMESTAMP_NTZ(9),
    delivered_at TIMESTAMP_NTZ(9),
    created_at TIMESTAMP_NTZ(9) DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ(9)
) CLUSTER BY (order_date, order_status)
COMMENT = 'Order tracking and management table';

-- Customer analytics view
CREATE OR REPLACE SECURE VIEW ecommerce.analytics.customer_summary AS
SELECT 
    c.customer_id,
    c.first_name,
    c.last_name,
    c.email,
    c.registration_date,
    c.customer_status,
    COUNT(o.order_id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as total_spent,
    MAX(o.order_date) as last_order_date,
    DATEDIFF('day', c.registration_date, CURRENT_DATE()) as days_as_customer
FROM ecommerce.customer.customers c
LEFT JOIN ecommerce.orders.orders o ON c.customer_id = o.customer_id
WHERE c.customer_status = 'ACTIVE'
GROUP BY c.customer_id, c.first_name, c.last_name, c.email, 
         c.registration_date, c.customer_status
COMMENT = 'Customer analytics and summary metrics';

-- Order status update procedure
CREATE OR REPLACE PROCEDURE ecommerce.orders.update_order_status(
    order_id_param NUMBER,
    new_status VARCHAR DEFAULT 'PROCESSING',
    update_user VARCHAR DEFAULT 'SYSTEM'
)
RETURNS STRING
LANGUAGE SQL
COMMENT = 'Update order status with audit trail'
AS
$$
BEGIN
    UPDATE ecommerce.orders.orders 
    SET 
        order_status = new_status,
        updated_at = CURRENT_TIMESTAMP()
    WHERE order_id = order_id_param;
    
    INSERT INTO ecommerce.audit.order_status_changes (
        order_id, 
        old_status, 
        new_status, 
        changed_by, 
        changed_at
    )
    SELECT 
        order_id_param,
        LAG(order_status) OVER (ORDER BY updated_at),
        new_status,
        update_user,
        CURRENT_TIMESTAMP();
    
    RETURN 'Order status updated to: ' || new_status;
END;
$$;

-- Product inventory view
CREATE VIEW ecommerce.inventory.low_stock_products AS
SELECT 
    p.product_id,
    p.product_name,
    p.sku,
    i.current_stock,
    i.minimum_threshold,
    i.maximum_threshold,
    CASE 
        WHEN i.current_stock <= 0 THEN 'OUT_OF_STOCK'
        WHEN i.current_stock <= i.minimum_threshold THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
    END as stock_status
FROM ecommerce.catalog.products p
JOIN ecommerce.inventory.inventory i ON p.product_id = i.product_id
WHERE i.current_stock <= i.minimum_threshold
ORDER BY i.current_stock ASC;
