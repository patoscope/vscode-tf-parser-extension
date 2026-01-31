/**
 * Terraform 0.84 converter for Snowflake DDL objects
 * Converts parsed DDL objects to Terraform HCL format
 */

import { DDLObject, TableDefinition, ViewDefinition, ProcedureDefinition, ColumnDefinition, ConstraintDefinition } from './sqlParser';

export interface TerraformResource {
  type: string;
  name: string;
  content: string;
  dependencies?: string[];
  constraints?: ConstraintDefinition[];
}

export class TerraformConverter {
  
  /**
   * Convert array of DDL objects to Terraform resources with dependency analysis
   */
  public convertToTerraform(objects: DDLObject[]): TerraformResource[] {
    const resources: TerraformResource[] = [];
    
    // First pass: convert all objects to resources
    for (const obj of objects) {
      if ('query' in obj) {
        // View (has query property)
        const resource = this.convertView(obj as ViewDefinition);
        if (resource) {
          resources.push(resource);
        }
      } else if ('columns' in obj) {
        // Table (has columns but no query)
        const table = obj as TableDefinition;
        const tableResource = this.convertTable(table);
        if (tableResource) {
          resources.push(tableResource);
        }
        
        // Create separate constraint resources for each constraint
        if (table.constraints && table.constraints.length > 0) {
          for (const constraint of table.constraints) {
            const constraintResource = this.convertTableConstraint(table, constraint);
            if (constraintResource) {
              resources.push(constraintResource);
            }
          }
        }
      } else if ('body' in obj) {
        // Procedure
        const resource = this.convertProcedure(obj as ProcedureDefinition);
        if (resource) {
          resources.push(resource);
        }
      }
    }
    
    // Second pass: analyze dependencies and add depends_on clauses
    this.analyzeDependencies(objects, resources);
    
    return resources;
  }
  
  /**
   * Convert a single DDL object to Terraform
   */
  public convertSingle(obj: DDLObject): TerraformResource | null {
    if ('columns' in obj) {
      return this.convertTable(obj as TableDefinition);
    } else if ('query' in obj) {
      return this.convertView(obj as ViewDefinition);
    } else if ('body' in obj) {
      return this.convertProcedure(obj as ProcedureDefinition);
    }
    return null;
  }
  
  private convertTable(table: TableDefinition): TerraformResource {
    const resourceName = this.generateResourceName('table', table.name, table.schema);
    
    let content = `resource "snowflake_table" "${resourceName}" {\n`;
    
    if (table.database) {
      content += `  database = local.databases[var.DATABASE]\n`;
    }
    
    if (table.schema) {
      content += `  schema = snowflake_schema.${this.convertToSchemaReference(table.schema)}.name\n`;
    }
    
    content += `  name = "${table.name}"\n`;
    
    if (table.comment) {
      content += `  comment = "${this.escapeString(table.comment)}"\n`;
    }
    
    if (table.clusterBy && table.clusterBy.length > 0) {
      content += `\n  cluster_by = [${table.clusterBy.map(col => `"${col}"`).join(', ')}]\n`;
    }
    
    // Add columns with blank line before first column
    if (table.columns && table.columns.length > 0) {
      content += '\n';
      for (const column of table.columns) {
        content += '\n';
        content += this.convertColumn(column);
      }
    }
    
    content += '}\n';
    
    return {
      type: 'snowflake_table',
      name: resourceName,
      content,
      dependencies: []
    };
  }

  /**
   * Convert a table constraint to a separate Terraform resource
   */
  private convertTableConstraint(table: TableDefinition, constraint: ConstraintDefinition): TerraformResource {
    const tableName = this.generateResourceName('table', table.name, table.schema);
    const constraintResourceName = `${tableName}_${constraint.name}`;
    
    let content = `resource "snowflake_table_constraint" "${constraintResourceName}" {\n`;
    content += `  name = "${constraint.name}"\n\n`;
    content += `  type = "${constraint.type}"\n`;
    content += `  table_id = snowflake_table.${tableName}.fully_qualified_name\n\n`;
    
    if (constraint.columns && constraint.columns.length > 0) {
      content += `  columns = [\n`;
      for (let i = 0; i < constraint.columns.length; i++) {
        const col = constraint.columns[i];
        const isLast = i === constraint.columns.length - 1;
        content += `    "${col}"${isLast ? '' : ','}\n`;
      }
      content += `  ]\n`;
    }
    
    // Add constraint-specific properties
    if (constraint.properties) {
      if (constraint.properties.deferrable !== undefined) {
        content += `  deferrable = ${constraint.properties.deferrable ? 'true' : 'false'}\n`;
      } else {
        content += `  deferrable = false\n`;
      }
      
      if (constraint.properties.enable !== undefined) {
        content += `  enable = ${constraint.properties.enable ? 'true' : 'false'}\n`;
      } else {
        content += `  enable = false\n`;
      }
      
      if (constraint.properties.rely) {
        content += `  rely = true\n`;
      }
    } else {
      // Default properties
      content += `  deferrable = false\n`;
      content += `  enable = false\n`;
    }
    
    content += '}\n';
    
    return {
      type: 'snowflake_table_constraint',
      name: constraintResourceName,
      content,
      dependencies: [tableName] // Constraint depends on the table
    };
  }

  private convertView(view: ViewDefinition): TerraformResource {
    const resourceName = this.generateResourceName('view', view.name, view.schema);
    
    let content = `resource "snowflake_view" "${resourceName}" {\n`;
    
    if (view.database) {
      content += `  database = local.databases[var.DATABASE]\n`;
    }
    
    if (view.schema) {
      content += `  schema = snowflake_schema.${this.convertToSchemaReference(view.schema)}.name\n`;
    }
    
    content += `  name = "${view.name}"\n`;
    
    if (view.comment) {
      content += `  comment = "${this.escapeString(view.comment)}"\n`;
    }
    
    // Add copy_grants
    content += `\n  copy_grants = true\n`;
    
    if (view.secure) {
      content += `  is_secure = true\n`;
    }
    
    // Handle multi-line SQL queries
    const query = this.formatSqlQuery(view.query);
    content += `  statement = <<-EOT\n${query}\nEOT\n`;
    
    // Add column definitions at the end if present
    if (view.columns && view.columns.length > 0) {
      content += `\n`;
      for (const column of view.columns) {
        content += `  column {\n`;
        content += `    column_name = "${column.name}"\n`;
        content += `  }\n`;
        content += `\n`;
      }
    }
    
    content += '}\n';
    
    return {
      type: 'snowflake_view',
      name: resourceName,
      content,
      dependencies: []
    };
  }
  
  private convertProcedure(procedure: ProcedureDefinition): TerraformResource {
    const resourceName = this.generateResourceName('procedure', procedure.name, procedure.schema);
    
    // Determine resource type based on language
    const resourceType = procedure.language && procedure.language.toUpperCase() === 'JAVASCRIPT' 
      ? 'snowflake_procedure_javascript' 
      : 'snowflake_procedure';
    
    let content = `resource "${resourceType}" "${resourceName}" {\n`;
    
    if (procedure.database) {
      content += `  database = local.databases[var.DATABASE]\n`;
    }
    
    if (procedure.schema) {
      content += `  schema = snowflake_schema.${this.convertToSchemaReference(procedure.schema)}.name\n`;
    }
    
    content += `  name = "${procedure.name}"\n`;
    
    // Add arguments for JavaScript procedures (before other properties)
    if (resourceType === 'snowflake_procedure_javascript' && procedure.parameters.length > 0) {
      content += `\n\n`;
      for (let i = 0; i < procedure.parameters.length; i++) {
        const param = procedure.parameters[i];
        content += `  arguments {\n`;
        content += `    arg_name = "${param.name}"\n`;
        content += `    arg_data_type = "${param.type}"\n`;
        content += `  }\n`;
        // Add empty line between arguments, but not after the last one
        if (i < procedure.parameters.length - 1) {
          content += `\n`;
        }
      }
    }
    
    if (procedure.returnType) {
      content += `  return_type = "${procedure.returnType}"\n`;
    }
    
    // Add comment if present and not for OWNER procedures
    if (procedure.comment && procedure.executeAs !== "OWNER") {
      content += `  comment = "${procedure.comment}"\n`;
    }
    
    // Add execute_as for JavaScript procedures (after arguments)
    if (resourceType === 'snowflake_procedure_javascript') {
      const executeAs = procedure.executeAs || 'OWNER';
      content += `  execute_as = "${executeAs}"\n`;
    }
    
    // Add procedure body with appropriate attribute name
    // Don't use formatSqlQuery for procedure bodies - preserve indentation
    let body = procedure.body;
    // Replace database names with Terraform variables
    body = body.replace(/DB_CDI_DEV_DWH/g, '${local.databases["DWH"]}');
    body = body.replace(/DB_CDI_DEV_STG/g, '${local.databases["STG"]}');
    body = body.replace(/DB_CDI_DEV_DM/g, '${local.databases["DM"]}');
    // Replace schema names (remove _SANDBOX suffix)
    body = body.replace(/RDV_MDM_SANDBOX/g, 'RDV_MDM');
    body = body.replace(/BDV_MDM_SANDBOX/g, 'BDV_MDM');
    body = body.replace(/TOOLS_SANDBOX/g, 'TOOLS');
    
    // Unescape double single quotes to single quotes for consistency with reference files
    body = body.replace(/''/g, "'");
    
    // Unescape double backslashes to single backslashes
    body = body.replace(/\\\\/g, '\\');
    
    const bodyAttribute = resourceType === 'snowflake_procedure_javascript' 
      ? 'procedure_definition' 
      : 'statement';
    
    // Only escape ${} to $${} for Terraform heredoc - don't change quotes or other formatting
    const convertedBody = body.replace(/\$\{/g, '$$\$\{');
    
    // Use <<EOT for OWNER procedures, <<-EOT for others
    const heredocStart = procedure.executeAs === "OWNER" ? '<<EOT' : '<<-EOT';
    content += '  ' + bodyAttribute + ' = ' + heredocStart + '\n' + convertedBody + 'EOT\n';
    
    const withClosing = content + '}\n';
    
    return {
      type: resourceType,
      name: resourceName,
      content: withClosing,
      dependencies: []
    };
  }
  
  /**
   * Analyze dependencies between DDL objects and add depends_on clauses
   */
  private analyzeDependencies(objects: DDLObject[], resources: TerraformResource[]): void {
    // Create mapping of object names to resource names for quick lookup
    const objectToResource = new Map<string, string>();
    
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const resource = resources[i];
      if (obj && resource) {
        const fullName = this.getFullObjectName(obj);
        objectToResource.set(fullName, resource.name);
      }
    }
    
    // Analyze each object for dependencies
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const resource = resources[i];
      if (!obj || !resource) {
        continue;
      }
      
      const dependencies: string[] = [];
      
      // Tables depend on their schema, but views and procedures do not include schema in depends_on
      if (obj.schema && 'columns' in obj && !('query' in obj) && !('body' in obj)) {
        const schemaRef = this.convertToSchemaReference(obj.schema);
        dependencies.push(`snowflake_schema.${schemaRef}`);
      }
      
      if ('query' in obj) {
        // Views depend on tables/views referenced in their queries (only same schema)
        const viewDependencies = this.extractViewDependencies(obj as ViewDefinition, objectToResource);
        dependencies.push(...viewDependencies);
      } else if ('body' in obj) {
        // Procedures depend on tables/views referenced in their bodies
        const procedureDependencies = this.extractProcedureDependencies(obj as ProcedureDefinition, objectToResource);
        dependencies.push(...procedureDependencies);
      }
      
      // Update the resource with dependencies and regenerate content if needed
      // Add depends_on for views and procedures to match reference files
      if (dependencies.length > 0 && ('query' in obj || 'body' in obj)) {
        resource.dependencies = dependencies;
        resource.content = this.addDependsOnClause(resource.content, dependencies);
      }
    }
  }
  
  /**
   * Get the full qualified name of a DDL object
   */
  private getFullObjectName(obj: DDLObject): string {
    let name = obj.name;
    if (obj.schema) {
      name = `${obj.schema}.${name}`;
    }
    if (obj.database) {
      name = `${obj.database}.${obj.schema || ''}.${obj.name}`;
    }
    return name;
  }
  
  /**
   * Extract table/view dependencies from a view's SQL query
   * Extracts dependencies directly from FROM/JOIN clauses, only including objects from the same schema
   */
  private extractViewDependencies(view: ViewDefinition, objectToResource: Map<string, string>): string[] {
    const dependencies: string[] = [];
    const query = view.query.toUpperCase();
    const viewSchema = view.schema?.toUpperCase();
    
    // Extract all table references from FROM and JOIN clauses
    // Matches: database.schema.table, ${template}.schema.table, schema.table, or just table
    // Handles both original database names and template variables
    const tableReferences = [
      ...query.matchAll(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)/gi),
      ...query.matchAll(/FROM\s+\$\{[^}]+\}\.([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)/gi),
      ...query.matchAll(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)/gi),
      ...query.matchAll(/JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)/gi),
      ...query.matchAll(/JOIN\s+\$\{[^}]+\}\.([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)/gi),
      ...query.matchAll(/JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)/gi)
    ];
    
    for (const match of tableReferences) {
      let schemaName: string | undefined;
      let objectName: string | undefined;
      
      if (match.length === 4) {
        // 3-part name: database.schema.table
        schemaName = match[2];
        objectName = match[3];
      } else if (match.length === 3) {
        // 2-part name: schema.table or ${...}.schema.table
        schemaName = match[1];
        objectName = match[2];
      }
      
      if (schemaName && objectName) {
        // Remove _SANDBOX suffix from schema for comparison
        const normalizedSchema = schemaName.replace(/_SANDBOX$/i, '').toUpperCase();
        const normalizedViewSchema = viewSchema?.replace(/_SANDBOX$/i, '').toUpperCase();
        
        // Only include if from the same schema (after removing _SANDBOX)
        if (normalizedSchema === normalizedViewSchema) {
          // Determine resource type based on naming convention
          const resourceType = objectName.toUpperCase().startsWith('VW_') ? 'snowflake_view' : 'snowflake_table';
          
          // Generate resource name using the same format as generateResourceName
          const resourceName = this.convertToSchemaReference(schemaName) + '_' + objectName.toUpperCase();
          
          dependencies.push(`${resourceType}.${resourceName}`);
        }
      } else if (!viewSchema && objectName) {
        // No schema in either SQL or view definition - assume same "default" schema
        // Determine resource type based on naming convention
        const resourceType = objectName.toUpperCase().startsWith('VW_') ? 'snowflake_view' : 'snowflake_table';
        const resourceName = objectName.toUpperCase();
        
        dependencies.push(`${resourceType}.${resourceName}`);
      }
    }
    
    return [...new Set(dependencies)].sort((a, b) => {
      // Sort by resource type first (tables before views), then alphabetically
      const aType = a.startsWith('snowflake_table') ? 0 : 1;
      const bType = b.startsWith('snowflake_table') ? 0 : 1;
      if (aType !== bType) {
        return aType - bType;
      }
      return a.localeCompare(b);
    }); // Remove duplicates
  }
  
  /**
   * Extract table/view dependencies from a procedure's SQL body
   */
  private extractProcedureDependencies(procedure: ProcedureDefinition, objectToResource: Map<string, string>): string[] {
    const dependencies: string[] = [];
    const body = procedure.body.toUpperCase();
    
    // Look for table references in UPDATE, INSERT, DELETE, SELECT statements
    const tableReferences = [
      ...body.matchAll(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*\.?[a-zA-Z_][a-zA-Z0-9_]*\.?[a-zA-Z_][a-zA-Z0-9_]*)/gi),
      ...body.matchAll(/UPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*\.?[a-zA-Z_][a-zA-Z0-9_]*\.?[a-zA-Z_][a-zA-Z0-9_]*)/gi),
      ...body.matchAll(/INTO\s+([a-zA-Z_][a-zA-Z0-9_]*\.?[a-zA-Z_][a-zA-Z0-9_]*\.?[a-zA-Z_][a-zA-Z0-9_]*)/gi),
      ...body.matchAll(/DELETE\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*\.?[a-zA-Z_][a-zA-Z0-9_]*\.?[a-zA-Z_][a-zA-Z0-9_]*)/gi)
    ];
    
    for (const match of tableReferences) {
      const referencedTable = match[1].toLowerCase();
      
      // Check if this table exists in our object mapping
      for (const [fullName, resourceName] of objectToResource.entries()) {
        if (this.matchesTableReference(fullName, referencedTable)) {
          dependencies.push(`snowflake_table.${resourceName}`);
          break;
        }
      }
    }
    
    return [...new Set(dependencies)].sort((a, b) => {
      // Sort by resource type first (tables before views), then alphabetically
      const aType = a.startsWith('snowflake_table') ? 0 : 1;
      const bType = b.startsWith('snowflake_table') ? 0 : 1;
      if (aType !== bType) {
        return aType - bType;
      }
      return a.localeCompare(b);
    }); // Remove duplicates
  }
  
  /**
   * Check if a full object name matches a table reference from SQL
   */
  private matchesTableReference(fullName: string, reference: string): boolean {
    const fullNameLower = fullName.toLowerCase();
    const referenceLower = reference.toLowerCase();
    
    // Exact match
    if (fullNameLower === referenceLower) {
      return true;
    }
    
    // Check if reference matches the end of fullName (schema.table matches database.schema.table)
    const fullNameParts = fullNameLower.split('.');
    const referenceParts = referenceLower.split('.');
    
    if (referenceParts.length <= fullNameParts.length) {
      const relevantFullNameParts = fullNameParts.slice(-referenceParts.length);
      return relevantFullNameParts.join('.') === referenceParts.join('.');
    }
    
    return false;
  }
  
  /**
   * Add depends_on clause to Terraform resource content after the name clause
   */
  private addDependsOnClause(content: string, dependencies: string[]): string {
    const lines = content.split('\n');
    
    // Find the line with 'EOT' (end of statement) to insert depends_on after it
    let insertIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === 'EOT') {
        insertIndex = i + 1;
        break;
      }
    }
    
    // If name not found, insert before closing brace (fallback)
    if (insertIndex === -1) {
      insertIndex = lines.length - 1;
    }
    
    // Build depends_on clause with proper formatting
    const dependsOnLines = ['', 'depends_on = ['];
    for (let i = 0; i < dependencies.length; i++) {
      const dep = dependencies[i];
      const isLast = i === dependencies.length - 1;
      dependsOnLines.push(`    ${dep}${isLast ? '' : ','}`);
    }
    dependsOnLines.push('  ]');
    
    // Insert all lines at once
    lines.splice(insertIndex, 0, ...dependsOnLines);
    
    return lines.join('\n');
  }

  private convertColumn(column: ColumnDefinition): string {
    let content = `  column {\n`;
    content += `    name = "${column.name}"\n`;
    
    if (column.type) {
      content += `    type = "${this.convertDataType(column.type)}"\n`;
    }
    
    if (!column.nullable) {
      content += `    nullable = false\n`;
    }
    
    // Add comment BEFORE default block (matches TOPICS format)
    if (column.comment) {
      content += `    comment = "${this.escapeString(column.comment)}"\n`;
    }
    
    // Add default block (blank line separator comes naturally from above)
    if (column.defaultValue) {
      content += `\n    default {\n`;
      
      // Determine if this is a constant (numeric/boolean literal) or an expression (function call)
      const isConstant = this.isConstantValue(column.defaultValue);
      
      if (isConstant) {
        // For constants, use unquoted value
        content += `      constant = ${column.defaultValue}\n`;
      } else {
        // For expressions (functions), use quoted expression
        content += `      expression = "${this.escapeString(column.defaultValue)}"\n`;
      }
      
      content += `    }\n`;
    }
    
    content += `  }\n`;
    
    return content;
  }
  
  /**
   * Determine if a default value is a constant (numeric/boolean) or an expression (function call)
   */
  private isConstantValue(value: string): boolean {
    const trimmed = value.trim().toUpperCase();
    
    // Check for numeric values (0, 1, 123, -1, etc.)
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return true;
    }
    
    // Check for boolean values
    if (trimmed === 'TRUE' || trimmed === 'FALSE') {
      return true;
    }
    
    // String literals (enclosed in quotes) should be treated as expressions, not constants
    // Everything else is an expression (function calls, string literals, etc.)
    return false;
  }
  
  private convertDataType(sqlType: string | undefined): string {
    // Convert SQL data types to Snowflake Terraform format
    if (!sqlType) {
      return 'VARCHAR(16777216)'; // Default to string type
    }
    
    const upperType = sqlType.toUpperCase();
    
    // Handle common type mappings
    const typeMap: Record<string, string> = {
      'INT': 'NUMBER(38,0)',
      'INTEGER': 'NUMBER(38,0)',
      'BIGINT': 'NUMBER(38,0)',
      'SMALLINT': 'NUMBER(38,0)',
      'TINYINT': 'NUMBER(38,0)',
      'BYTEINT': 'NUMBER(38,0)',
      'FLOAT': 'FLOAT',
      'DOUBLE': 'FLOAT',
      'REAL': 'FLOAT',
      'TEXT': 'VARCHAR(16777216)',
      'STRING': 'VARCHAR(16777216)',
      'BINARY': 'BINARY',
      'VARBINARY': 'BINARY',
      'BOOLEAN': 'BOOLEAN',
      'BOOL': 'BOOLEAN',
      'DATE': 'DATE',
      'DATETIME': 'TIMESTAMP_NTZ(9)',
      'TIME': 'TIME(9)',
      'TIMESTAMP': 'TIMESTAMP_NTZ(9)',
      'VARIANT': 'VARIANT',
      'OBJECT': 'OBJECT',
      'ARRAY': 'ARRAY'
    };
    
    // Check for exact matches first
    if (typeMap[upperType]) {
      return typeMap[upperType];
    }
    
    // Handle parameterized types
    if (upperType.startsWith('VARCHAR')) {
      return sqlType; // Keep as-is for VARCHAR(n)
    }
    if (upperType.startsWith('CHAR')) {
      return sqlType; // Keep as-is for CHAR(n)
    }
    if (upperType.startsWith('NUMBER') || upperType.startsWith('NUMERIC') || upperType.startsWith('DECIMAL')) {
      return sqlType; // Keep as-is for NUMBER(p,s)
    }
    if (upperType.startsWith('TIMESTAMP')) {
      return sqlType; // Keep as-is for TIMESTAMP variants
    }
    
    // Default: return as-is
    return sqlType;
  }
  
  private formatSqlQuery(query: string): string {
    // Format SQL query for Terraform heredoc
    // Preserve the original SQL formatting and indentation - don't modify it
    let formatted = query.trim();
    
    // Replace database names with Terraform variables
    formatted = formatted.replace(/DB_CDI_DEV_DWH/g, '${local.databases["DWH"]}');
    formatted = formatted.replace(/DB_CDI_DEV_STG/g, '${local.databases["STG"]}');
    formatted = formatted.replace(/DB_CDI_DEV_DM/g, '${local.databases["DM"]}');
    
    // Replace schema names (remove _SANDBOX suffix)
    formatted = formatted.replace(/RDV_MDM_SANDBOX/g, 'RDV_MDM');
    formatted = formatted.replace(/BDV_MDM_SANDBOX/g, 'BDV_MDM');
    formatted = formatted.replace(/TOOLS_SANDBOX/g, 'TOOLS');
    // Add more as needed
    
    return formatted;
  }
  
  private generateResourceName(type: string, name: string, schema?: string): string {
    // Generate a valid Terraform resource name following Azure DevOps pattern
    let resourceName = name.toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&'); // Prefix with underscore if starts with number

    // Include schema prefix in resource name to match TOPICS conventions
    if (schema) {
      const schemaPrefix = this.convertToSchemaReference(schema);
      resourceName = `${schemaPrefix}_${resourceName}`;
    }

    // For tables, views, and procedures, use uppercase naming as per your example
    return resourceName;
  }

  private convertToSchemaReference(schema: string): string {
    // Convert schema name to a valid Terraform resource reference
    let cleanSchema = schema.toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&');
    
    // Remove _SANDBOX suffix if present
    if (cleanSchema.endsWith('_SANDBOX')) {
      cleanSchema = cleanSchema.replace(/_SANDBOX$/, '');
    }
    
    return cleanSchema;
  }
  
  private escapeString(str: string): string {
    // Escape string for Terraform - handle all special characters properly
    return str
      .replace(/\\/g, '\\\\')     // Escape backslashes first
      .replace(/"/g, '\\"')       // Escape double quotes
      .replace(/'/g, "\\'")       // Escape single quotes
      .replace(/\n/g, '\\n')      // Escape newlines
      .replace(/\r/g, '\\r')      // Escape carriage returns
      .replace(/\t/g, '\\t')      // Escape tabs
      .replace(/\$/g, '\\$')      // Escape dollar signs (important for Terraform)
      .replace(/\u0000/g, '\\0'); // Escape null characters
  }
  
  /**
   * Generate a complete Terraform file with resources
   */
  public generateTerraformFile(resources: TerraformResource[]): string {
    let content = '';
    
    for (let i = 0; i < resources.length; i++) {
      if (i > 0) {
        content += '\n';
      }
      content += resources[i].content;
    }
    
    return content;
  }
}
