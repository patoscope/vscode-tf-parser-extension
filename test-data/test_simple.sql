-- Simple test file for the Snowflake to Terraform extension

CREATE TABLE employees (
    id NUMBER(38,0) NOT NULL,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(50),
    salary NUMBER(10,2),
    hire_date DATE
);

CREATE VIEW active_employees AS
SELECT id, name, department
FROM employees
WHERE salary > 0;
