-- Test SQL file to demonstrate dependency analysis
-- This file contains objects with clear dependencies that should generate depends_on clauses

-- Base table (no dependencies)
CREATE TABLE users (
    id NUMBER(38,0) NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    is_active BOOLEAN DEFAULT TRUE
) COMMENT = 'User management table';

-- Another base table (no dependencies)
CREATE TABLE products (
    product_id NUMBER(38,0) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    price NUMBER(10,2) DEFAULT 0.00,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
) COMMENT = 'Product catalog table';

-- Table that depends on users (via foreign key reference in real world)
CREATE TABLE orders (
    order_id NUMBER(38,0) NOT NULL,
    user_id NUMBER(38,0) NOT NULL,
    product_id NUMBER(38,0) NOT NULL,
    order_date DATE NOT NULL,
    total_amount DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'PENDING'
) COMMENT = 'Orders table linking users and products';

-- View that depends on users table
CREATE VIEW active_users AS
SELECT id, username, email, created_at
FROM users
WHERE is_active = TRUE;

-- View that depends on multiple tables
CREATE VIEW order_summary AS
SELECT 
    u.username,
    p.product_name,
    o.order_date,
    o.total_amount,
    o.status
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN products p ON o.product_id = p.product_id
WHERE o.status != 'CANCELLED';

-- Procedure that depends on users table
CREATE PROCEDURE update_user_status(
    user_id_param NUMBER,
    new_status BOOLEAN DEFAULT TRUE
)
RETURNS STRING
LANGUAGE SQL
COMMENT = 'Updates user active status'
AS
BEGIN
    UPDATE users 
    SET is_active = new_status,
        updated_at = CURRENT_TIMESTAMP()
    WHERE id = user_id_param;
    
    RETURN 'User status updated successfully';
END;

-- Procedure that depends on multiple tables
CREATE PROCEDURE process_order(
    order_id_param NUMBER
)
RETURNS STRING
LANGUAGE SQL
COMMENT = 'Process an order and update related tables'
AS
BEGIN
    UPDATE orders 
    SET status = 'PROCESSING'
    WHERE order_id = order_id_param;
    
    INSERT INTO order_history 
    SELECT order_id, user_id, 'PROCESSING', CURRENT_TIMESTAMP()
    FROM orders
    WHERE order_id = order_id_param;
    
    RETURN 'Order processed successfully';
END;
