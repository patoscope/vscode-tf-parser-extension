import * as assert from 'assert';
import { TerraformConverter } from '../terraformConverter';
import { SnowflakeDDLParser, TableDefinition, ViewDefinition, ProcedureDefinition } from '../sqlParser';

suite('Terraform Converter Test Suite', () => {
    let converter: TerraformConverter;
    let parser: SnowflakeDDLParser;

    setup(() => {
        converter = new TerraformConverter();
        parser = new SnowflakeDDLParser();
    });

    test('Convert simple table to Terraform', () => {
        const table: TableDefinition = {
            name: 'users',
            columns: [
                { name: 'id', type: 'NUMBER(38,0)', nullable: false },
                { name: 'name', type: 'VARCHAR(100)', nullable: true },
                { name: 'email', type: 'VARCHAR(255)', nullable: true, defaultValue: "'test@example.com'" }
            ]
        };

        const resource = converter.convertSingle(table);
        assert.ok(resource);
        assert.strictEqual(resource.type, 'snowflake_table');
        assert.strictEqual(resource.name, 'USERS');
        assert.ok(resource.content.includes('name     = "users"'));
        assert.ok(resource.content.includes('nullable = false'));
        assert.ok(resource.content.includes('type = "NUMBER(38,0)"'));
    });

    test('Convert table with schema to Terraform', () => {
        const table: TableDefinition = {
            name: 'products',
            schema: 'sales',
            database: 'company_db',
            columns: [
                { name: 'product_id', type: 'NUMBER(38,0)', nullable: false },
                { name: 'product_name', type: 'VARCHAR(200)', nullable: false, comment: 'Product display name' }
            ],
            comment: 'Products catalog'
        };

        const resource = converter.convertSingle(table);
        assert.ok(resource);
        assert.strictEqual(resource.name, 'SALES_PRODUCTS');
        assert.ok(resource.content.includes('database = local.databases[var.DATABASE]'));
        assert.ok(resource.content.includes('schema   = snowflake_schema.SALES.name'));
        assert.ok(resource.content.includes('comment  = "Products catalog"'));
        assert.ok(resource.content.includes('comment = "Product display name"'));
    });

    test('Convert view to Terraform', () => {
        const view: ViewDefinition = {
            name: 'active_users',
            schema: 'public',
            query: 'SELECT id, name FROM users WHERE active = TRUE',
            secure: true,
            comment: 'View of active users only'
        };

        const resource = converter.convertSingle(view);
        assert.ok(resource);
        assert.strictEqual(resource.type, 'snowflake_view');
        assert.strictEqual(resource.name, 'PUBLIC_ACTIVE_USERS');
        assert.ok(resource.content.includes('is_secure = true'));
        assert.ok(resource.content.includes('comment  = "View of active users only"'));
        assert.ok(resource.content.includes('SELECT id, name FROM users WHERE active = TRUE'));
    });

    test('Convert procedure to Terraform', () => {
        const procedure: ProcedureDefinition = {
            name: 'update_status',
            schema: 'admin',
            parameters: [
                { name: 'user_id', type: 'NUMBER' },
                { name: 'new_status', type: 'BOOLEAN', defaultValue: 'TRUE' }
            ],
            returnType: 'STRING',
            language: 'SQL',
            body: 'BEGIN\n  UPDATE users SET active = new_status WHERE id = user_id;\n  RETURN \'Success\';\nEND;',
            comment: 'Updates user status'
        };

        const resource = converter.convertSingle(procedure);
        assert.ok(resource);
        assert.strictEqual(resource.type, 'snowflake_procedure');
        assert.strictEqual(resource.name, 'ADMIN_UPDATE_STATUS');
        assert.ok(resource.content.includes('language = "SQL"'));
        assert.ok(resource.content.includes('return_type = "STRING"'));
        assert.ok(resource.content.includes('name = "user_id"'));
        assert.ok(resource.content.includes('default_value = "TRUE"'));
        assert.ok(resource.content.includes('comment = "Updates user status"'));
    });

    test('Generate complete Terraform file with provider', () => {
        const sql = `
            CREATE TABLE test_table (id NUMBER, name VARCHAR(50));
            CREATE VIEW test_view AS SELECT * FROM test_table;
        `;

        const objects = parser.parseDDL(sql);
        const resources = converter.convertToTerraform(objects);
        const terraformFile = converter.generateTerraformFile(resources, true);

        assert.ok(terraformFile.includes('terraform {'));
        assert.ok(terraformFile.includes('required_providers {'));
        assert.ok(terraformFile.includes('Snowflake-Labs/snowflake'));
        assert.ok(terraformFile.includes('version = "~> 0.84"'));
        assert.ok(terraformFile.includes('provider "snowflake"'));
        assert.ok(terraformFile.includes('variable "DATABASE"'));
        assert.ok(terraformFile.includes('variable "ENVIRONMENT"'));
        assert.ok(terraformFile.includes('locals {'));
        assert.ok(terraformFile.includes('databases = {'));
        assert.ok(terraformFile.includes('DB_CDI_DEV_DWH'));
        assert.ok(terraformFile.includes('resource "snowflake_table"'));
        assert.ok(terraformFile.includes('resource "snowflake_view"'));
    });

    test('Data type conversion', () => {
        const table: TableDefinition = {
            name: 'type_test',
            columns: [
                { name: 'int_col', type: 'INT', nullable: true },
                { name: 'text_col', type: 'TEXT', nullable: true },
                { name: 'bool_col', type: 'BOOLEAN', nullable: true },
                { name: 'timestamp_col', type: 'TIMESTAMP', nullable: true },
                { name: 'varchar_col', type: 'VARCHAR(100)', nullable: true }
            ]
        };

        const resource = converter.convertSingle(table);
        assert.ok(resource);
        assert.ok(resource.content.includes('type = "NUMBER(38,0)"')); // INT -> NUMBER(38,0)
        assert.ok(resource.content.includes('type = "VARCHAR(16777216)"')); // TEXT -> VARCHAR(16777216)
        assert.ok(resource.content.includes('type = "BOOLEAN"')); // BOOLEAN stays the same
        assert.ok(resource.content.includes('type = "TIMESTAMP_NTZ(9)"')); // TIMESTAMP -> TIMESTAMP_NTZ(9)
        assert.ok(resource.content.includes('type = "VARCHAR(100)"')); // VARCHAR(100) stays the same
    });

    test('Handle table with clustering', () => {
        const table: TableDefinition = {
            name: 'clustered_table',
            columns: [
                { name: 'date_col', type: 'DATE', nullable: false },
                { name: 'id_col', type: 'NUMBER', nullable: false }
            ],
            clusterBy: ['date_col', 'id_col']
        };

        const resource = converter.convertSingle(table);
        assert.ok(resource);
        assert.ok(resource.content.includes('cluster_by = ["date_col", "id_col"]'));
    });

    test('Escape special characters in strings', () => {
        const table: TableDefinition = {
            name: 'escape_test',
            columns: [
                { name: 'test_col', type: 'VARCHAR(100)', nullable: true, comment: 'Comment with "quotes" and \\ backslashes' }
            ],
            comment: 'Table comment with\nnewlines and\ttabs'
        };

        const resource = converter.convertSingle(table);
        assert.ok(resource);
        assert.ok(resource.content.includes('\\"quotes\\"'));
        assert.ok(resource.content.includes('\\\\'));
        assert.ok(resource.content.includes('\\n'));
        assert.ok(resource.content.includes('\\t'));
    });

    test('Remove _SANDBOX suffix from schema references', () => {
        const table: TableDefinition = {
            name: 'test_table',
            schema: 'RDV_SANDBOX',
            database: 'DB_CDI_DEV_DWH',
            columns: [
                { name: 'id', type: 'NUMBER(38,0)', nullable: false }
            ]
        };

        const resource = converter.convertSingle(table);
        assert.ok(resource);
        assert.strictEqual(resource.name, 'RDV_SANDBOX_TEST_TABLE');
        assert.ok(resource.content.includes('schema   = snowflake_schema.RDV.name'));
        assert.ok(!resource.content.includes('snowflake_schema.RDV_SANDBOX.name'));
    });

    test('Convert table with default values using expression syntax', () => {
        const table: TableDefinition = {
            name: 'test_defaults',
            columns: [
                { name: 'id', type: 'NUMBER(38,0)', nullable: false },
                { name: 'MD_IS_DELETED', type: 'NUMBER(1)', nullable: false, defaultValue: '0', comment: 'Indique si la ligne est soft-supprimée ou non' },
                { name: 'MD_CREATION_DT', type: 'TIMESTAMP_NTZ(9)', nullable: false, defaultValue: 'CURRENT_TIMESTAMP()', comment: 'DATE ET HEURE INSERE' },
                { name: 'status', type: 'VARCHAR(50)', nullable: true, defaultValue: "'active'" }
            ]
        };

        const resource = converter.convertSingle(table);
        assert.ok(resource);
        assert.strictEqual(resource.type, 'snowflake_table');
        assert.strictEqual(resource.name, 'TEST_DEFAULTS');
        
        // Check that default values use expression syntax, not constant
        assert.ok(resource.content.includes('expression = "0"'));
        assert.ok(resource.content.includes('expression = "CURRENT_TIMESTAMP()"'));
        assert.ok(resource.content.includes('expression = "\'active\'"'));
        
        // Make sure it doesn't contain the old constant syntax
        assert.ok(!resource.content.includes('constant = '));
    });
});
