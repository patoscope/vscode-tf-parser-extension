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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sqlParser_1 = require("../../src/sqlParser");
const terraformConverter_1 = require("../../src/terraformConverter");
suite('Integration Tests - Fixture Validation', () => {
    let parser;
    let converter;
    const fixtureDir = path.join(__dirname, '../fixtures');
    setup(() => {
        parser = new sqlParser_1.SnowflakeDDLParser();
        converter = new terraformConverter_1.TerraformConverter();
    });
    /**
     * Gets all SQL fixture files and their corresponding TF reference files
     */
    function getFixturePairs() {
        const files = fs.readdirSync(fixtureDir);
        const sqlFiles = files.filter(f => f.endsWith('.sql'));
        return sqlFiles.map(sqlFile => {
            const name = sqlFile.replace('.sql', '');
            const sqlPath = path.join(fixtureDir, sqlFile);
            const tfPath = path.join(fixtureDir, `${name}.tf`);
            return { name, sqlPath, tfPath };
        });
    }
    /**
     * Validates that parsed SQL objects have required properties
     */
    function validateParsedObjects(objects) {
        for (const obj of objects) {
            if ('columns' in obj) {
                // Table or similar
                assert.ok(obj.name, `Table should have a name: ${JSON.stringify(obj)}`);
                assert.ok(Array.isArray(obj.columns), `Table should have columns array: ${JSON.stringify(obj)}`);
            }
            else if ('query' in obj) {
                // View
                assert.ok(obj.name, `View should have a name: ${JSON.stringify(obj)}`);
                assert.ok(obj.query, `View should have a query: ${JSON.stringify(obj)}`);
            }
            else if ('body' in obj) {
                // Procedure
                assert.ok(obj.name, `Procedure should have a name: ${JSON.stringify(obj)}`);
            }
        }
    }
    /**
     * Tests each fixture pair:
     * 1. Reads SQL file
     * 2. Parses it
     * 3. Converts to Terraform
     * 4. Generates HCL
     * 5. Validates structure
     */
    test('All fixture files parse and convert without errors', () => {
        const fixtures = getFixturePairs();
        assert.ok(fixtures.length > 0, 'No SQL fixtures found in test/fixtures/');
        const results = [];
        for (const { name, sqlPath, tfPath } of fixtures) {
            try {
                // Check that both files exist
                assert.ok(fs.existsSync(sqlPath), `SQL fixture not found: ${sqlPath}`);
                assert.ok(fs.existsSync(tfPath), `Terraform reference file not found: ${tfPath}`);
                // Read SQL content
                const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
                assert.ok(sqlContent.length > 0, `SQL fixture is empty: ${name}.sql`);
                // Parse SQL
                const parsedObjects = parser.parseDDL(sqlContent);
                assert.ok(parsedObjects.length > 0, `Failed to parse SQL fixture: ${name}.sql (parsed 0 objects)`);
                // Validate parsed objects
                validateParsedObjects(parsedObjects);
                // Convert to Terraform
                const terraformResources = converter.convertToTerraform(parsedObjects);
                assert.ok(terraformResources.length > 0, `Failed to convert to Terraform: ${name}.sql (converted 0 resources)`);
                // Generate Terraform HCL
                const generatedHcl = converter.generateTerraformFile(terraformResources);
                assert.ok(generatedHcl.length > 0, `Generated empty Terraform HCL: ${name}.sql`);
                // Validate generated HCL contains resource definitions
                assert.ok(generatedHcl.includes('resource "snowflake_'), `Generated HCL doesn't contain resource definitions: ${name}.sql`);
                results.push({ name, success: true });
            }
            catch (error) {
                results.push({
                    name,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        // Report results
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        console.log(`\n✓ Fixture Validation Results:`);
        console.log(`  Success: ${successCount}/${results.length}`);
        if (failureCount > 0) {
            console.log(`  Failures: ${failureCount}`);
            results.filter(r => !r.success).forEach(r => {
                console.log(`    ✗ ${r.name}: ${r.error}`);
            });
        }
        // Assert all passed
        assert.strictEqual(failureCount, 0, `${failureCount} fixture(s) failed to parse/convert`);
    });
    /**
     * Tests that generated Terraform contains expected resource types
     */
    test('Generated Terraform resources match fixture content', () => {
        const fixtures = getFixturePairs();
        for (const { name, sqlPath } of fixtures) {
            const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
            const parsedObjects = parser.parseDDL(sqlContent);
            const terraformResources = converter.convertToTerraform(parsedObjects);
            const generatedHcl = converter.generateTerraformFile(terraformResources);
            // Validate resource types match parsed content
            for (const obj of parsedObjects) {
                if ('columns' in obj) {
                    // Table
                    assert.ok(generatedHcl.includes('resource "snowflake_table"'), `Missing snowflake_table resource in ${name}.tf`);
                }
                else if ('query' in obj) {
                    // View
                    assert.ok(generatedHcl.includes('resource "snowflake_view"') ||
                        generatedHcl.includes('resource "snowflake_dynamic_table"'), `Missing snowflake_view resource in ${name}.tf`);
                }
                else if ('body' in obj) {
                    // Procedure
                    assert.ok(generatedHcl.includes('resource "snowflake_procedure') ||
                        generatedHcl.includes('resource "snowflake_function'), `Missing snowflake_procedure resource in ${name}.tf`);
                }
            }
        }
    });
    /**
     * Validates that resource names are properly formatted
     */
    test('Generated Terraform resource names are properly formatted', () => {
        const fixtures = getFixturePairs();
        for (const { name, sqlPath } of fixtures) {
            const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
            const parsedObjects = parser.parseDDL(sqlContent);
            const terraformResources = converter.convertToTerraform(parsedObjects);
            for (const resource of terraformResources) {
                // Resource name should be snake_case or uppercase
                assert.ok(resource.name && resource.name.length > 0, `Resource has empty name in ${name}`);
                // Resource type should start with 'snowflake_'
                assert.ok(resource.type.startsWith('snowflake_'), `Resource type doesn't start with 'snowflake_' in ${name}: ${resource.type}`);
                // Content should not be empty
                assert.ok(resource.content && resource.content.length > 0, `Resource content is empty in ${name}`);
            }
        }
    });
    /**
     * Tests that all parsed objects have required metadata
     */
    test('Parsed SQL objects contain required metadata', () => {
        const fixtures = getFixturePairs();
        for (const { name, sqlPath } of fixtures) {
            const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
            const parsedObjects = parser.parseDDL(sqlContent);
            for (const obj of parsedObjects) {
                // All objects must have a name
                assert.ok(obj.name && obj.name.length > 0, `Parsed object has no name in ${name}`);
                // Tables should have columns
                if ('columns' in obj) {
                    assert.ok(Array.isArray(obj.columns) && obj.columns.length > 0, `Table has no columns in ${name}: ${obj.name}`);
                    // Each column should have name and type
                    for (const col of obj.columns) {
                        assert.ok(col.name && col.name.length > 0, `Column has no name in table ${obj.name}`);
                        assert.ok(col.type && col.type.length > 0, `Column ${col.name} has no type in table ${obj.name}`);
                        assert.ok(typeof col.nullable === 'boolean', `Column ${col.name} nullable should be boolean`);
                    }
                }
                // Views should have query
                if ('query' in obj) {
                    assert.ok(obj.query && obj.query.length > 0, `View has no query in ${name}: ${obj.name}`);
                }
                // Procedures should have body
                if ('body' in obj) {
                    assert.ok(obj.body && obj.body.length > 0, `Procedure has no body in ${name}: ${obj.name}`);
                }
            }
        }
    });
    /**
     * Tests that generated HCL is valid Terraform syntax
     */
    test('Generated Terraform HCL contains valid syntax structure', () => {
        const fixtures = getFixturePairs();
        for (const { name, sqlPath } of fixtures) {
            const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
            const parsedObjects = parser.parseDDL(sqlContent);
            const terraformResources = converter.convertToTerraform(parsedObjects);
            const generatedHcl = converter.generateTerraformFile(terraformResources);
            // Should contain resource blocks
            assert.ok(generatedHcl.includes('resource '), `No resource blocks found in ${name}.tf`);
            // Resource blocks should have proper structure: resource "type" "name" { ... }
            const resourcePattern = /resource\s+"[^"]+"\s+"[^"]+"\s*\{/;
            assert.ok(resourcePattern.test(generatedHcl), `Invalid resource block structure in ${name}.tf`);
            // Should have balanced braces
            const openBraces = (generatedHcl.match(/\{/g) || []).length;
            const closeBraces = (generatedHcl.match(/\}/g) || []).length;
            assert.strictEqual(openBraces, closeBraces, `Unbalanced braces in ${name}.tf (open: ${openBraces}, close: ${closeBraces})`);
        }
    });
});
//# sourceMappingURL=integration.test.js.map