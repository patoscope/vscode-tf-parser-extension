/**
 * Terraform 0.84 converter for Snowflake DDL objects
 * Converts parsed DDL objects to Terraform HCL format
 */

import { DDLObject, TableDefinition, ViewDefinition, ProcedureDefinition, ColumnDefinition } from './sqlParser';

export interface TerraformResource {
  type: string;
  name: string;
  content: string;
  dependencies?: string[];
}

export class TerraformConverter {
  
  /**
   * Convert array of DDL objects to Terraform resources with dependency analysis
   */
  public convertToTerraform(objects: DDLObject[]): TerraformResource[] {
    const resources: TerraformResource[] = [];
    
    // First pass: convert all objects to resources
    for (const obj of objects) {
      if ('columns' in obj) {
        // Table
        const resource = this.convertTable(obj as TableDefinition);
        if (resource) {
          resources.push(resource);
        }
      } else if ('query' in obj) {
        // View
        const resource = this.convertView(obj as ViewDefinition);
        if (resource) {
          resources.push(resource);
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
    content += `  name     = "${table.name}"\n`;
    
    if (table.database) {
      content += `  database = local.databases[var.DATABASE]\n`;
    }
    
    if (table.schema) {
      content += `  schema   = snowflake_schema.${this.convertToSchemaReference(table.schema)}.name\n`;
    }
    
    if (table.comment) {
      content += `  comment  = "${this.escapeString(table.comment)}"\n`;
    }
    
    if (table.clusterBy && table.clusterBy.length > 0) {
      content += `  cluster_by = [${table.clusterBy.map(col => `"${col}"`).join(', ')}]\n`;
    }
    
    // Add columns
    for (const column of table.columns) {
      content += '\n';
      content += this.convertColumn(column);
    }
    
    content += '}\n';
    
    return {
      type: 'snowflake_table',
      name: resourceName,
      content,
      dependencies: []
    };
  }
  
  private convertView(view: ViewDefinition): TerraformResource {
    const resourceName = this.generateResourceName('view', view.name, view.schema);
    
    let content = `resource "snowflake_view" "${resourceName}" {\n`;
    content += `  name     = "${view.name}"\n`;
    
    if (view.database) {
      content += `  database = local.databases[var.DATABASE]\n`;
    }
    
    if (view.schema) {
      content += `  schema   = snowflake_schema.${this.convertToSchemaReference(view.schema)}.name\n`;
    }
    
    if (view.comment) {
      content += `  comment  = "${this.escapeString(view.comment)}"\n`;
    }
    
    if (view.secure) {
      content += `  is_secure = true\n`;
    }
    
    if (view.or_replace) {
      content += `  or_replace = true\n`;
    }
    
    // Handle multi-line SQL queries
    const query = this.formatSqlQuery(view.query);
    content += `  statement = <<-EOT\n${query}\nEOT\n`;
    
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
    
    let content = `resource "snowflake_procedure" "${resourceName}" {\n`;
    content += `  name     = "${procedure.name}"\n`;
    
    if (procedure.database) {
      content += `  database = local.databases[var.DATABASE]\n`;
    }
    
    if (procedure.schema) {
      content += `  schema   = snowflake_schema.${this.convertToSchemaReference(procedure.schema)}.name\n`;
    }
    
    if (procedure.language) {
      content += `  language = "${procedure.language.toUpperCase()}"\n`;
    }
    
    if (procedure.returnType) {
      content += `  return_type = "${procedure.returnType}"\n`;
    }
    
    if (procedure.comment) {
      content += `  comment = "${this.escapeString(procedure.comment)}"\n`;
    }
    
    // Add arguments
    if (procedure.parameters.length > 0) {
      for (const param of procedure.parameters) {
        content += '\n';
        content += `  argument {\n`;
        content += `    name = "${param.name}"\n`;
        content += `    type = "${param.type}"\n`;
        if (param.defaultValue) {
          content += `    default_value = "${this.escapeString(param.defaultValue)}"\n`;
        }
        content += `  }\n`;
      }
    }
    
    // Add procedure body
    const body = this.formatSqlQuery(procedure.body);
    content += `\n  statement = <<-EOT\n${body}\nEOT\n`;
    
    content += '}\n';
    
    return {
      type: 'snowflake_procedure',
      name: resourceName,
      content,
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
      
      if ('query' in obj) {
        // Views depend on tables/views referenced in their queries
        const viewDependencies = this.extractViewDependencies(obj as ViewDefinition, objectToResource);
        dependencies.push(...viewDependencies);
      } else if ('body' in obj) {
        // Procedures depend on tables/views referenced in their bodies
        const procedureDependencies = this.extractProcedureDependencies(obj as ProcedureDefinition, objectToResource);
        dependencies.push(...procedureDependencies);
      }
      
      // Update the resource with dependencies and regenerate content if needed
      if (dependencies.length > 0) {
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
   */
  private extractViewDependencies(view: ViewDefinition, objectToResource: Map<string, string>): string[] {
    const dependencies: string[] = [];
    const query = view.query.toUpperCase();
    
    // Simple regex patterns to find FROM and JOIN clauses
    // This is a basic implementation - could be enhanced with a proper SQL parser
    const tableReferences = [
      ...query.matchAll(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*\.?[a-zA-Z_][a-zA-Z0-9_]*\.?[a-zA-Z_][a-zA-Z0-9_]*)/gi),
      ...query.matchAll(/JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*\.?[a-zA-Z_][a-zA-Z0-9_]*\.?[a-zA-Z_][a-zA-Z0-9_]*)/gi)
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
    
    return [...new Set(dependencies)]; // Remove duplicates
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
    
    return [...new Set(dependencies)]; // Remove duplicates
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
   * Add depends_on clause to Terraform resource content
   */
  private addDependsOnClause(content: string, dependencies: string[]): string {
    // Find the insertion point (before the closing brace)
    const lines = content.split('\n');
    const lastLineIndex = lines.length - 1;
    
    // Insert depends_on clause before the closing brace
    const dependsOnClause = `  depends_on = [${dependencies.join(', ')}]`;
    lines.splice(lastLineIndex, 0, '', dependsOnClause);
    
    return lines.join('\n');
  }

  private convertColumn(column: ColumnDefinition): string {
    let content = `  column {\n`;
    content += `    name = "${column.name}"\n`;
    content += `    type = "${this.convertDataType(column.type)}"\n`;
    
    if (!column.nullable) {
      content += `    nullable = false\n`;
    }
    
    if (column.defaultValue) {
      content += `    default {\n`;
      content += `      expression = "${this.escapeString(column.defaultValue)}"\n`;
      content += `    }\n`;
    }
    
    if (column.comment) {
      content += `    comment = "${this.escapeString(column.comment)}"\n`;
    }
    
    content += `  }\n`;
    
    return content;
  }
  
  private convertDataType(sqlType: string): string {
    // Convert SQL data types to Snowflake Terraform format
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
    // Handle dollar-quoted strings and complex SQL properly
    
    // If it's a dollar-quoted string, preserve it as-is but with proper indentation
    if (query.trim().startsWith('$$') || query.includes('$$')) {
      const lines = query.split('\n');
      return lines.map(line => {
        if (line.trim() === '') {
          return '';
        }
        return '    ' + line; // Add 4-space indent for Terraform
      }).join('\n').trim();
    }
    
    // For regular SQL, remove leading/trailing whitespace and normalize indentation
    const lines = query.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim());
    
    if (nonEmptyLines.length === 0) {
      return query.trim();
    }
    
    // Find minimum indentation (excluding empty lines)
    const minIndent = Math.min(
      ...nonEmptyLines.map(line => {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
      })
    );
    
    // Remove common indentation and format
    const formatted = lines.map(line => {
      if (line.trim() === '') {
        return '';
      }
      // Remove the minimum indentation and add 4-space indent for Terraform
      const content = line.slice(minIndent);
      return '    ' + content;
    }).join('\n');
    
    return formatted.trim();
  }
  
  private generateResourceName(type: string, name: string, schema?: string): string {
    // Generate a valid Terraform resource name following Azure DevOps pattern
    let resourceName = name.toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&'); // Prefix with underscore if starts with number
    
    if (schema) {
      const schemaName = schema.toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_')
        .replace(/^[0-9]/, '_$&');
      //resourceName = `${schemaName}_${resourceName}`;
      resourceName = `${resourceName}`;
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
