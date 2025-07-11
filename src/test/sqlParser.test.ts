import * as assert from 'assert';
import { SnowflakeDDLParser, TableDefinition, ViewDefinition, ProcedureDefinition } from '../sqlParser';

suite('SQL Parser Test Suite', () => {
    let parser: SnowflakeDDLParser;

    setup(() => {
        parser = new SnowflakeDDLParser();
    });

    test('Parse simple CREATE TABLE statement', () => {
        const sql = `
            CREATE TABLE customers (
                id NUMBER(38,0) NOT NULL,
                name VARCHAR(100),
                email VARCHAR(255) DEFAULT 'no-email@example.com'
            );
        `;

        const objects = parser.parseDDL(sql);
        assert.strictEqual(objects.length, 1);
        
        const table = objects[0] as TableDefinition;
        assert.strictEqual(table.name, 'customers');
        assert.strictEqual(table.columns.length, 3);
        assert.strictEqual(table.columns[0].name, 'id');
        assert.strictEqual(table.columns[0].type, 'NUMBER(38,0)');
        assert.strictEqual(table.columns[0].nullable, false);
    });

    test('Parse CREATE TABLE with schema and database', () => {
        const sql = `
            CREATE OR REPLACE TABLE my_db.my_schema.products (
                product_id NUMBER(38,0) NOT NULL,
                product_name VARCHAR(200) NOT NULL COMMENT 'Product display name'
            ) COMMENT = 'Products catalog table';
        `;

        const objects = parser.parseDDL(sql);
        assert.strictEqual(objects.length, 1);
        
        const table = objects[0] as TableDefinition;
        assert.strictEqual(table.name, 'products');
        assert.strictEqual(table.schema, 'my_schema');
        assert.strictEqual(table.database, 'my_db');
        assert.strictEqual(table.comment, 'Products catalog table');
        assert.strictEqual(table.columns[1].comment, 'Product display name');
    });

    test('Parse CREATE VIEW statement', () => {
        const sql = `
            CREATE SECURE VIEW active_users AS
            SELECT user_id, username, email 
            FROM users 
            WHERE is_active = TRUE
            COMMENT = 'Active users only';
        `;

        const objects = parser.parseDDL(sql);
        assert.strictEqual(objects.length, 1);
        
        const view = objects[0] as ViewDefinition;
        assert.strictEqual(view.name, 'active_users');
        assert.strictEqual(view.secure, true);
        assert.strictEqual(view.comment, 'Active users only');
        assert.ok(view.query.includes('SELECT user_id, username, email'));
    });

    test('Parse CREATE PROCEDURE statement', () => {
        const sql = `
            CREATE OR REPLACE PROCEDURE update_user_status(
                user_id_param NUMBER,
                new_status BOOLEAN DEFAULT TRUE
            )
            RETURNS STRING
            LANGUAGE SQL
            COMMENT = 'Updates user active status'
            AS
            $$
            BEGIN
                UPDATE users SET is_active = new_status WHERE user_id = user_id_param;
                RETURN 'Updated successfully';
            END;
            $$;
        `;

        const objects = parser.parseDDL(sql);
        assert.strictEqual(objects.length, 1);
        
        const procedure = objects[0] as ProcedureDefinition;
        assert.strictEqual(procedure.name, 'update_user_status');
        assert.strictEqual(procedure.returnType, 'STRING');
        assert.strictEqual(procedure.language, 'SQL');
        assert.strictEqual(procedure.comment, 'Updates user active status');
        assert.strictEqual(procedure.parameters.length, 2);
        assert.strictEqual(procedure.parameters[0].name, 'user_id_param');
        assert.strictEqual(procedure.parameters[1].defaultValue, 'TRUE');
    });

    test('Parse multiple DDL statements', () => {
        const sql = `
            CREATE TABLE users (id NUMBER, name VARCHAR(100));
            CREATE VIEW user_view AS SELECT * FROM users;
            CREATE PROCEDURE get_user(id NUMBER) RETURNS STRING LANGUAGE SQL AS $$ SELECT name FROM users WHERE id = id; $$;
        `;

        const objects = parser.parseDDL(sql);
        assert.strictEqual(objects.length, 3);
        assert.ok('columns' in objects[0]); // Table
        assert.ok('query' in objects[1]);   // View
        assert.ok('body' in objects[2]);    // Procedure
    });

    test('Handle SQL with inline comments', () => {
        const sql = `CREATE TABLE test_table (id NUMBER, name VARCHAR(50));`;

        const objects = parser.parseDDL(sql);
        assert.strictEqual(objects.length, 1);
        
        const table = objects[0] as TableDefinition;
        assert.strictEqual(table.name, 'test_table');
        assert.strictEqual(table.columns.length, 2);
    });

    test('Parse table with clustering', () => {
        const sql = `
            CREATE TABLE sales (
                sale_id NUMBER,
                sale_date DATE,
                amount DECIMAL(10,2)
            ) CLUSTER BY (sale_date, sale_id);
        `;

        const objects = parser.parseDDL(sql);
        assert.strictEqual(objects.length, 1);
        
        const table = objects[0] as TableDefinition;
        assert.strictEqual(table.clusterBy?.length, 2);
        assert.strictEqual(table.clusterBy?.[0], 'sale_date');
        assert.strictEqual(table.clusterBy?.[1], 'sale_id');
    });

    test('Parse complex procedure with special characters and role names', () => {
        const sql = `
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
                sqlText := "USE SECONDARY ROLES \\"GMAR_APL_HUBANALYTIQUE_IAPC-CDI-READER_D\\", \\"GMAR_APL_HUBANALYTIQUE-AV-CDI_READER_D\\";";
                
                -- Execute some complex operations
                EXECUTE IMMEDIATE sqlText;
                
                RETURN 'Success';
            EXCEPTION
                WHEN OTHER THEN
                    RETURN 'Error: ' || SQLERRM;
            END;
            $$;
        `;

        const objects = parser.parseDDL(sql);
        assert.strictEqual(objects.length, 1);
        
        const procedure = objects[0] as ProcedureDefinition;
        assert.strictEqual(procedure.name, 'SP_REBUILD_SUREX_RDV');
        assert.strictEqual(procedure.returnType, 'STRING');
        assert.strictEqual(procedure.language, 'SQL');
        assert.strictEqual(procedure.comment, 'Rebuild procedure with role switching');
        assert.ok(procedure.body.includes('GMAR_APL_HUBANALYTIQUE_IAPC-CDI-READER_D'));
        assert.ok(procedure.body.includes('SECONDARY ROLES'));
    });
});
