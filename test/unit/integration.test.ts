import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { SnowflakeDDLParser } from '../../src/sqlParser';
import { TerraformConverter } from '../../src/terraformConverter';

suite('Integration Tests - Fixture Validation', () => {
    let parser: SnowflakeDDLParser;
    let converter: TerraformConverter;

    setup(() => {
        parser = new SnowflakeDDLParser();
        converter = new TerraformConverter();
    });

    /**
     * Gets all SQL fixture files and their corresponding TF reference files
     */
    function getFixturePairs(): Array<{ name: string; sqlPath: string; tfPath: string }> {
        // The test is run from the vscode-tf-parser-extension directory
        // __dirname in compiled form points to out/test/unit
        // Navigate up to find the project root by looking for package.json
        let currentPath = __dirname;
        while (currentPath !== path.dirname(currentPath)) {
            const packageJsonPath = path.join(currentPath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                break;
            }
            currentPath = path.dirname(currentPath);
        }
        
        const fixtureDir = path.join(currentPath, 'test', 'fixtures');
        
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
    function validateParsedObjects(objects: any[]): void {
        for (const obj of objects) {
            if ('query' in obj) {
                // View
                assert.ok(obj.name, `View should have a name: ${JSON.stringify(obj)}`);
                assert.ok(obj.query, `View should have a query: ${JSON.stringify(obj)}`);
            } else if ('columns' in obj) {
                // Table or similar
                assert.ok(obj.name, `Table should have a name: ${JSON.stringify(obj)}`);
                assert.ok(Array.isArray(obj.columns), `Table should have columns array: ${JSON.stringify(obj)}`);
            } else if ('body' in obj) {
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

        const results: Array<{ name: string; success: boolean; error?: string }> = [];

        for (const { name, sqlPath, tfPath } of fixtures) {
            try {
                // Check that both files exist
                assert.ok(
                    fs.existsSync(sqlPath),
                    `SQL fixture not found: ${sqlPath}`
                );
                assert.ok(
                    fs.existsSync(tfPath),
                    `Terraform reference file not found: ${tfPath}`
                );

                // Read SQL content
                const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
                assert.ok(
                    sqlContent.length > 0,
                    `SQL fixture is empty: ${name}.sql`
                );

                // Parse SQL
                const parsedObjects = parser.parseDDL(sqlContent);
                assert.ok(
                    parsedObjects.length > 0,
                    `Failed to parse SQL fixture: ${name}.sql (parsed 0 objects)`
                );

                // Validate parsed objects
                validateParsedObjects(parsedObjects);

                // Convert to Terraform
                const terraformResources = converter.convertToTerraform(parsedObjects);
                assert.ok(
                    terraformResources.length > 0,
                    `Failed to convert to Terraform: ${name}.sql (converted 0 resources)`
                );

                // Generate Terraform HCL
                const generatedHcl = converter.generateTerraformFile(terraformResources);
                assert.ok(
                    generatedHcl.length > 0,
                    `Generated empty Terraform HCL: ${name}.sql`
                );

                // Validate generated HCL contains resource definitions
                assert.ok(
                    generatedHcl.includes('resource "snowflake_'),
                    `Generated HCL doesn't contain resource definitions: ${name}.sql`
                );

                results.push({ name, success: true });
            } catch (error) {
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
        assert.strictEqual(
            failureCount,
            0,
            `${failureCount} fixture(s) failed to parse/convert`
        );
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
                if ('query' in obj) {
                    // View
                    assert.ok(
                        generatedHcl.includes('resource "snowflake_view"') ||
                        generatedHcl.includes('resource "snowflake_dynamic_table"'),
                        `Missing snowflake_view resource in ${name}.tf`
                    );
                } else if ('columns' in obj) {
                    // Table
                    assert.ok(
                        generatedHcl.includes('resource "snowflake_table"'),
                        `Missing snowflake_table resource in ${name}.tf`
                    );
                } else if ('body' in obj) {
                    // Procedure
                    assert.ok(
                        generatedHcl.includes('resource "snowflake_procedure') ||
                        generatedHcl.includes('resource "snowflake_function'),
                        `Missing snowflake_procedure resource in ${name}.tf`
                    );
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
                assert.ok(
                    resource.name && resource.name.length > 0,
                    `Resource has empty name in ${name}`
                );
                // Resource type should start with 'snowflake_'
                assert.ok(
                    resource.type.startsWith('snowflake_'),
                    `Resource type doesn't start with 'snowflake_' in ${name}: ${resource.type}`
                );
                // Content should not be empty
                assert.ok(
                    resource.content && resource.content.length > 0,
                    `Resource content is empty in ${name}`
                );
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
                assert.ok(
                    obj.name && obj.name.length > 0,
                    `Parsed object has no name in ${name}`
                );

                // Tables should have columns
                if ('columns' in obj && obj.columns && obj.columns.length > 0 && 'type' in obj.columns[0]) {
                    // This is a table with ColumnDefinition
                    // Each column should have name and type
                    for (const col of obj.columns as any) {
                        assert.ok(
                            col.name && col.name.length > 0,
                            `Column has no name in table ${obj.name}`
                        );
                        if ('type' in col) {
                            assert.ok(
                                col.type && col.type.length > 0,
                                `Column ${col.name} has no type in table ${obj.name}`
                            );
                            assert.ok(
                                typeof col.nullable === 'boolean',
                                `Column ${col.name} nullable should be boolean`
                            );
                        }
                    }
                }

                // Views should have query
                if ('query' in obj) {
                    assert.ok(
                        obj.query && obj.query.length > 0,
                        `View has no query in ${name}: ${obj.name}`
                    );
                }

                // Procedures should have body
                if ('body' in obj) {
                    assert.ok(
                        obj.body && obj.body.length > 0,
                        `Procedure has no body in ${name}: ${obj.name}`
                    );
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
            assert.ok(
                generatedHcl.includes('resource '),
                `No resource blocks found in ${name}.tf`
            );

            // Resource blocks should have proper structure: resource "type" "name" { ... }
            const resourcePattern = /resource\s+"[^"]+"\s+"[^"]+"\s*\{/;
            assert.ok(
                resourcePattern.test(generatedHcl),
                `Invalid resource block structure in ${name}.tf`
            );

            // Should have balanced braces (excluding heredocs which may have unbalanced braces)
            // Remove heredoc content to avoid false positives
            const hclWithoutHeredocs = generatedHcl.replace(/<<-?[A-Z_]+[\s\S]*?\n[A-Z_]+\n/g, '');
            const openBraces = (hclWithoutHeredocs.match(/\{/g) || []).length;
            const closeBraces = (hclWithoutHeredocs.match(/\}/g) || []).length;
            assert.strictEqual(
                openBraces,
                closeBraces,
                `Unbalanced braces in ${name}.tf (open: ${openBraces}, close: ${closeBraces}) - Note: heredoc content excluded`
            );
        }
    });

    /**
     * Tests that generated Terraform matches the reference files in TOPICS repo
     */
    test('Generated Terraform matches TOPICS reference files', () => {
        const fixtures = getFixturePairs();
        const mismatches: Array<{ name: string; differences: string[] }> = [];

        // Create output directory
        const outputDir = path.join(path.dirname(__dirname), '..', '..', 'test-output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        for (const { name, sqlPath, tfPath } of fixtures) {
            try {
                // Read and parse SQL
                const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
                const parsedObjects = parser.parseDDL(sqlContent);
                const terraformResources = converter.convertToTerraform(parsedObjects);
                const generatedHcl = converter.generateTerraformFile(terraformResources);

                // Write generated output to test-output folder
                const generatedOutputPath = path.join(outputDir, `${name}.generated.tf`);
                fs.writeFileSync(generatedOutputPath, generatedHcl, 'utf-8');

                // Read reference file
                const referenceContent = fs.readFileSync(tfPath, 'utf-8');

                // Write reference to test-output folder for comparison
                const referenceOutputPath = path.join(outputDir, `${name}.reference.tf`);
                fs.writeFileSync(referenceOutputPath, referenceContent, 'utf-8');

                // Compare files directly (preserve formatting for Terraform HCL)
                if (generatedHcl !== referenceContent) {
                    // Find specific differences
                    const generatedLines = generatedHcl.split('\n');
                    const referenceLines = referenceContent.split('\n');
                    const differences: string[] = [];

                    // Create detailed diff
                    let diffContent = `Generated vs Reference - ${name}.tf\n`;
                    diffContent += `${'='.repeat(80)}\n\n`;
                    
                    const maxLines = Math.max(generatedLines.length, referenceLines.length);
                    for (let i = 0; i < maxLines; i++) {
                        const genLine = generatedLines[i] || '';
                        const refLine = referenceLines[i] || '';
                        
                        // Show line numbers
                        const lineNum = String(i + 1).padStart(4, ' ');
                        
                        if (genLine === refLine) {
                            diffContent += `${lineNum}  | ${genLine}\n`;
                        } else {
                            diffContent += `${lineNum}  | GEN: ${genLine}\n`;
                            diffContent += `     | REF: ${refLine}\n`;
                            differences.push(
                                `Line ${i + 1}:\n  Generated: ${genLine}\n  Reference: ${refLine}`
                            );
                        }
                    }

                    // Write diff file
                    const diffOutputPath = path.join(outputDir, `${name}.diff.txt`);
                    fs.writeFileSync(diffOutputPath, diffContent, 'utf-8');

                    mismatches.push({
                        name,
                        differences: differences.slice(0, 5) // Show first 5 differences
                    });
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                mismatches.push({
                    name,
                    differences: [errorMsg]
                });
            }
        }

        // Report results
        console.log(`\n╔════════════════════════════════════════════════════════════╗`);
        console.log(`║     TERRAFORM GENERATION vs TOPICS REFERENCE COMPARISON     ║`);
        console.log(`╚════════════════════════════════════════════════════════════╝`);
        console.log(`\nOutput saved to: ${outputDir}`);
        console.log(`\nMatches: ${fixtures.length - mismatches.length}/${fixtures.length}`);
        console.log(`Mismatches: ${mismatches.length}\n`);
        
        if (mismatches.length > 0) {
            mismatches.forEach(m => {
                console.log(`📄 ${m.name}.tf:`);
                console.log(`   ✓ Generated: ${m.name}.generated.tf`);
                console.log(`   ✓ Reference: ${m.name}.reference.tf`);
                console.log(`   ✓ Diff: ${m.name}.diff.txt`);
                m.differences.slice(0, 2).forEach(d => {
                    console.log(`   ${d.split('\n').join('\n   ')}`);
                });
                if (m.differences.length > 2) {
                    console.log(`   ... and ${m.differences.length - 2} more differences`);
                }
                console.log();
            });

            console.log(`📋 FILES CREATED:`);
            console.log(`   • .generated.tf - Your generated Terraform output`);
            console.log(`   • .reference.tf - The reference TOPICS file`);
            console.log(`   • .diff.txt - Detailed line-by-line comparison\n`);
        } else {
            console.log(`✅ All generated Terraform files match TOPICS reference files perfectly!\n`);
        }

        // Assert no mismatches - all files should match exactly
        assert.strictEqual(mismatches.length, 0, `Found ${mismatches.length} mismatched files. Check test-output directory for diff files.`);
    });
});
