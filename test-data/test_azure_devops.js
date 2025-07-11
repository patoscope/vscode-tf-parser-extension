const { SnowflakeDDLParser } = require('./out/sqlParser');
const { TerraformConverter } = require('./out/terraformConverter');
const fs = require('fs');

// Read the Azure DevOps test SQL
const sql = fs.readFileSync('azure_devops_test.sql', 'utf-8');

console.log('=== INPUT SQL ===');
console.log(sql);
console.log('\n=== GENERATED TERRAFORM ===');

// Parse and convert
const parser = new SnowflakeDDLParser();
const converter = new TerraformConverter();

const objects = parser.parseDDL(sql);
const resources = converter.convertToTerraform(objects);
const terraformFile = converter.generateTerraformFile(resources, true);

console.log(terraformFile);

// Write to file
fs.writeFileSync('azure_devops_test.tf', terraformFile);
console.log('\n=== OUTPUT SAVED TO azure_devops_test.tf ===');
