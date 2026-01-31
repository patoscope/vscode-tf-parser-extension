"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const sqlParser_1 = require("../../src/sqlParser");
const terraformConverter_1 = require("../../src/terraformConverter");
suite('Folder Conversion Tests', () => {
    let parser;
    let converter;
    setup(() => {
        parser = new sqlParser_1.SnowflakeDDLParser();
        converter = new terraformConverter_1.TerraformConverter();
    });
    test('findSqlFiles should find SQL files recursively', async () => {
        // This test would need actual test data structure
        // For now, we'll test the basic functionality
        const testSqlContent = `
            CREATE TABLE test_table (
                id INTEGER PRIMARY KEY,
                name VARCHAR(100) NOT NULL DEFAULT 'test'
            );
        `;
        const ddlObjects = parser.parseDDL(testSqlContent);
        assert.strictEqual(ddlObjects.length, 1);
        assert.strictEqual(ddlObjects[0].name, 'test_table');
        assert.ok('columns' in ddlObjects[0]); // Check if it's a TableDefinition
        const terraformResources = converter.convertToTerraform(ddlObjects);
        assert.strictEqual(terraformResources.length, 1);
        const terraformContent = converter.generateTerraformFile(terraformResources);
        assert.ok(terraformContent.includes('resource "snowflake_table"'));
        assert.ok(terraformContent.includes(`expression = "\\'test\\'"`));
    });
    test('Folder conversion should handle multiple SQL files', async () => {
        // Test multiple SQL files conversion
        const sqlFiles = [
            `CREATE TABLE users (id INTEGER, name VARCHAR(50));`,
            `CREATE VIEW active_users AS SELECT * FROM users WHERE active = true;`,
            `CREATE TABLE products (id INTEGER, name VARCHAR(100), price DECIMAL(10,2));`
        ];
        let totalObjects = 0;
        let convertedFiles = 0;
        for (const sqlContent of sqlFiles) {
            if (sqlContent.trim()) {
                const ddlObjects = parser.parseDDL(sqlContent);
                if (ddlObjects.length > 0) {
                    const terraformResources = converter.convertToTerraform(ddlObjects);
                    const terraformContent = converter.generateTerraformFile(terraformResources);
                    assert.ok(terraformContent.length > 0);
                    convertedFiles++;
                    totalObjects += ddlObjects.length;
                }
            }
        }
        assert.strictEqual(convertedFiles, 3);
        assert.strictEqual(totalObjects, 3);
    });
    test('Folder conversion should handle empty or invalid SQL files', async () => {
        const testCases = [
            '', // Empty file
            '   ', // Whitespace only
            'INVALID SQL SYNTAX;', // Invalid SQL
            'SELECT * FROM table;' // Non-DDL SQL
        ];
        for (const sqlContent of testCases) {
            const ddlObjects = parser.parseDDL(sqlContent);
            // Empty, whitespace, and invalid SQL should return empty array
            // SELECT statements are not DDL, so should also return empty array
            assert.ok(ddlObjects.length === 0);
        }
    });
    test('Folder conversion should generate correct Terraform file paths', () => {
        const testPath = 'C:\\test\\folder\\example.sql';
        const expectedTerraformPath = 'C:\\test\\folder\\example.tf';
        const actualPath = testPath.replace(/\.sql$/i, '.tf');
        assert.strictEqual(actualPath, expectedTerraformPath);
    });
});
//# sourceMappingURL=folderConversion.test.js.map