/**
 * SQL Parser for Snowflake DDL statements
 * Supports parsing of CREATE TABLE, CREATE VIEW, and CREATE PROCEDURE statements
 */

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  comment?: string;
}

export interface TableDefinition {
  name: string;
  schema?: string;
  database?: string;
  columns: ColumnDefinition[];
  comment?: string;
  clusterBy?: string[];
}

export interface ViewDefinition {
  name: string;
  schema?: string;
  database?: string;
  query: string;
  comment?: string;
  secure?: boolean;
  or_replace?: boolean;
}

export interface ProcedureDefinition {
  name: string;
  schema?: string;
  database?: string;
  parameters: Array<{
    name: string;
    type: string;
    defaultValue?: string;
  }>;
  returnType?: string;
  body: string;
  comment?: string;
  language?: string;
}

export type DDLObject = TableDefinition | ViewDefinition | ProcedureDefinition;

export class SnowflakeDDLParser {
  
  /**
   * Parse SQL DDL text and return array of DDL objects
   */
  public parseDDL(sql: string): DDLObject[] {
    const statements = this.splitStatements(sql);
    const objects: DDLObject[] = [];
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) {
        continue;
      }
      
      if (this.isCreateTable(trimmed)) {
        const table = this.parseCreateTable(trimmed);
        if (table) {
          objects.push(table);
        }
      } else if (this.isCreateView(trimmed)) {
        const view = this.parseCreateView(trimmed);
        if (view) {
          objects.push(view);
        }
      } else if (this.isCreateProcedure(trimmed)) {
        const procedure = this.parseCreateProcedure(trimmed);
        if (procedure) {
          objects.push(procedure);
        }
      }
    }
    
    return objects;
  }
  
  private splitStatements(sql: string): string[] {
    // Split on semicolons, but be careful of quoted strings and comments
    const statements: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inComment = false;
    let inBlockComment = false;
    let inDollarQuote = false;
    let dollarQuoteTag = '';
    
    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const nextChar = sql[i + 1];
      
      // Handle dollar-quoted strings ($$...$$)
      if (!inSingleQuote && !inDoubleQuote && !inComment && !inBlockComment) {
        if (char === '$' && !inDollarQuote) {
          // Look for dollar quote tag
          let j = i + 1;
          let tag = '';
          while (j < sql.length && sql[j] !== '$') {
            tag += sql[j];
            j++;
          }
          if (j < sql.length && sql[j] === '$') {
            // Found complete dollar quote
            inDollarQuote = true;
            dollarQuoteTag = tag;
            current += sql.substring(i, j + 1);
            i = j;
            continue;
          }
        } else if (char === '$' && inDollarQuote) {
          // Check if this ends the dollar quote
          let tag = '';
          let j = i + 1;
          while (j < sql.length && sql[j] !== '$') {
            tag += sql[j];
            j++;
          }
          if (j < sql.length && sql[j] === '$' && tag === dollarQuoteTag) {
            // End of dollar quote
            inDollarQuote = false;
            dollarQuoteTag = '';
            current += sql.substring(i, j + 1);
            i = j;
            continue;
          }
        }
      }
      
      if (!inDollarQuote && !inComment && !inBlockComment && !inSingleQuote && !inDoubleQuote) {
        if (char === '-' && nextChar === '-') {
          inComment = true;
          current += char;
          continue;
        }
        if (char === '/' && nextChar === '*') {
          inBlockComment = true;
          current += char;
          continue;
        }
        if (char === "'") {
          inSingleQuote = true;
        } else if (char === '"') {
          inDoubleQuote = true;
        } else if (char === ';') {
          const trimmed = current.trim();
          if (trimmed) {
            statements.push(trimmed);
          }
          current = '';
          continue;
        }
      } else if (inComment && char === '\n') {
        inComment = false;
        current += char; // Keep the actual newline
        continue;
      } else if (inBlockComment && char === '*' && nextChar === '/') {
        inBlockComment = false;
        current += char;
        i++; // Skip next char
        current += sql[i]; // Add the '/'
        continue;
      } else if (inSingleQuote && char === "'") {
        // Handle escaped quotes
        if (nextChar === "'") {
          current += char;
          i++;
          current += sql[i];
          continue;
        } else {
          inSingleQuote = false;
        }
      } else if (inDoubleQuote && char === '"') {
        // Handle escaped quotes
        if (nextChar === '"') {
          current += char;
          i++;
          current += sql[i];
          continue;
        } else {
          inDoubleQuote = false;
        }
      }
      
      current += char;
    }
    
    const trimmed = current.trim();
    if (trimmed) {
      statements.push(trimmed);
    }
    
    return statements;
  }
  
  private isCreateTable(statement: string): boolean {
    // Remove comments and normalize whitespace before checking
    const cleaned = this.removeComments(statement);
    return /^\s*CREATE\s+(OR\s+REPLACE\s+)?TABLE\s+/i.test(cleaned);
  }
  
  private isCreateView(statement: string): boolean {
    // Remove comments and normalize whitespace before checking
    const cleaned = this.removeComments(statement);
    return /^\s*CREATE\s+(OR\s+REPLACE\s+)?(SECURE\s+)?VIEW\s+/i.test(cleaned);
  }
  
  private isCreateProcedure(statement: string): boolean {
    // Remove comments and normalize whitespace before checking
    const cleaned = this.removeComments(statement);
    return /^\s*CREATE\s+(OR\s+REPLACE\s+)?PROCEDURE\s+/i.test(cleaned);
  }

  private removeComments(sql: string): string {
    let result = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inComment = false;
    let inBlockComment = false;
    let inDollarQuote = false;
    let dollarQuoteTag = '';
    
    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const nextChar = sql[i + 1];
      
      // Handle dollar-quoted strings first
      if (!inSingleQuote && !inDoubleQuote && !inComment && !inBlockComment) {
        if (char === '$' && !inDollarQuote) {
          // Look for dollar quote tag
          let j = i + 1;
          let tag = '';
          while (j < sql.length && sql[j] !== '$') {
            tag += sql[j];
            j++;
          }
          if (j < sql.length && sql[j] === '$') {
            // Found complete dollar quote
            inDollarQuote = true;
            dollarQuoteTag = tag;
            result += sql.substring(i, j + 1);
            i = j;
            continue;
          }
        } else if (char === '$' && inDollarQuote) {
          // Check if this ends the dollar quote
          let tag = '';
          let j = i + 1;
          while (j < sql.length && sql[j] !== '$') {
            tag += sql[j];
            j++;
          }
          if (j < sql.length && sql[j] === '$' && tag === dollarQuoteTag) {
            // End of dollar quote
            inDollarQuote = false;
            dollarQuoteTag = '';
            result += sql.substring(i, j + 1);
            i = j;
            continue;
          }
        }
      }
      
      if (!inDollarQuote && !inComment && !inBlockComment && !inSingleQuote && !inDoubleQuote) {
        if (char === '-' && nextChar === '-') {
          inComment = true;
          // Skip the line comment entirely (don't add to result)
          i++; // Skip the second '-' as well
          continue;
        }
        if (char === '/' && nextChar === '*') {
          inBlockComment = true;
          // Skip the block comment entirely
          i++; // Skip the '*' as well
          continue;
        }
        if (char === "'") {
          inSingleQuote = true;
          result += char;
        } else if (char === '"') {
          inDoubleQuote = true;
          result += char;
        } else {
          result += char;
        }
      } else if (inDollarQuote) {
        // Inside dollar quote, preserve everything
        result += char;
      } else if (inComment) {
        if (char === '\n') {
          inComment = false;
          result += char; // Keep the newline
        }
        // Skip everything else in the comment (don't add to result)
      } else if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
          inBlockComment = false;
          i++; // Skip the '/' as well
          result += ' '; // Replace with a space
        }
        // Skip everything else in the block comment
      } else if (inSingleQuote) {
        result += char;
        if (char === "'" && nextChar !== "'") {
          inSingleQuote = false;
        } else if (char === "'" && nextChar === "'") {
          // Handle escaped quote
          i++;
          result += sql[i];
        }
      } else if (inDoubleQuote) {
        result += char;
        if (char === '"' && nextChar !== '"') {
          inDoubleQuote = false;
        } else if (char === '"' && nextChar === '"') {
          // Handle escaped quote
          i++;
          result += sql[i];
        }
      }
    }
    
    return result;
  }
  
  private parseCreateTable(statement: string): TableDefinition | null {
    try {
      // Clean the statement first
      const cleanedStatement = this.removeComments(statement);
      
      // Extract table name
      const tableMatch = cleanedStatement.match(/CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+([^\s(]+)/i);
      if (!tableMatch) {
        return null;
      }
      
      const fullName = this.cleanIdentifier(tableMatch[1]);
      const { database, schema, name } = this.parseFullyQualifiedName(fullName);
      
      // Extract columns from between parentheses
      const columnsMatch = cleanedStatement.match(/\(([\s\S]*)\)/);
      if (!columnsMatch) {
        return null;
      }
      
      const columnsText = columnsMatch[1];
      const columns = this.parseColumns(columnsText);
      
      // Extract comment
      const commentMatch = cleanedStatement.match(/COMMENT\s*=\s*'([^']*)'/i);
      const comment = commentMatch ? commentMatch[1] : undefined;
      
      // Extract cluster by
      const clusterMatch = cleanedStatement.match(/CLUSTER\s+BY\s*\(([^)]+)\)/i);
      const clusterBy = clusterMatch ? 
        clusterMatch[1].split(',').map(col => this.cleanIdentifier(col.trim())) : 
        undefined;
      
      return {
        name,
        schema,
        database,
        columns,
        comment,
        clusterBy
      };
    } catch (error) {
      console.error('Error parsing CREATE TABLE:', error);
      return null;
    }
  }
  
  private parseCreateView(statement: string): ViewDefinition | null {
    try {
      // Clean the statement first
      const cleanedStatement = this.removeComments(statement);
      
      // Check for OR REPLACE and SECURE keywords
      const orReplace = /CREATE\s+OR\s+REPLACE\s+(?:SECURE\s+)?VIEW/i.test(cleanedStatement);
      const isSecure = /CREATE\s+(?:OR\s+REPLACE\s+)?SECURE\s+VIEW/i.test(cleanedStatement);

      // Extract view name
      const viewMatch = cleanedStatement.match(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:SECURE\s+)?VIEW\s+([^\s(]+)/i);
      if (!viewMatch) {
        return null;
      }

      const fullName = this.cleanIdentifier(viewMatch[1]);
      const { database, schema, name } = this.parseFullyQualifiedName(fullName);

      // Extract query (everything after AS)
      const asMatch = cleanedStatement.match(/\s+AS\s+([\s\S]+)/i);
      if (!asMatch) {
        return null;
      }

      const query = asMatch[1].trim();

      // Extract comment
      const commentMatch = cleanedStatement.match(/COMMENT\s*=\s*'([^']*)'/i);
      const comment = commentMatch ? commentMatch[1] : undefined;

      return {
        name,
        schema,
        database,
        query,
        comment,
        secure: isSecure,
        or_replace: orReplace
      };
    } catch (error) {
      console.error('Error parsing CREATE VIEW:', error);
      return null;
    }
  }
  
  private parseCreateProcedure(statement: string): ProcedureDefinition | null {
    try {
      // Clean the statement first
      const cleanedStatement = this.removeComments(statement);
      
      // Extract procedure name and parameters
      const procMatch = cleanedStatement.match(/CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+([^\s(]+)\s*\(([^)]*)\)/i);
      if (!procMatch) {
        return null;
      }
      
      const fullName = this.cleanIdentifier(procMatch[1]);
      const { database, schema, name } = this.parseFullyQualifiedName(fullName);
      const parametersText = procMatch[2];
      
      const parameters = this.parseParameters(parametersText);
      
      // Extract return type
      const returnMatch = cleanedStatement.match(/RETURNS\s+([^\s]+)/i);
      const returnType = returnMatch ? returnMatch[1] : undefined;
      
      // Extract language
      const languageMatch = cleanedStatement.match(/LANGUAGE\s+(\w+)/i);
      const language = languageMatch ? languageMatch[1] : 'SQL';
      
      // Extract body (everything after AS)
      const asMatch = cleanedStatement.match(/\s+AS\s+([\s\S]+)/i);
      if (!asMatch) {
        return null;
      }
      
      let body = asMatch[1].trim();
      
      // Remove trailing semicolon if present
      if (body.endsWith(';')) {
        body = body.slice(0, -1).trim();
      }
      
      // Extract comment
      const commentMatch = cleanedStatement.match(/COMMENT\s*=\s*'([^']*)'/i);
      const comment = commentMatch ? commentMatch[1] : undefined;
      
      return {
        name,
        schema,
        database,
        parameters,
        returnType,
        body,
        comment,
        language
      };
    } catch (error) {
      console.error('Error parsing CREATE PROCEDURE:', error);
      return null;
    }
  }
  
  private parseColumns(columnsText: string): ColumnDefinition[] {
    const columns: ColumnDefinition[] = [];
    
    // Split by commas, but be careful of nested parentheses
    const columnParts = this.splitByComma(columnsText);
    
    for (const part of columnParts) {
      const column = this.parseColumn(part.trim());
      if (column) {
        columns.push(column);
      }
    }
    
    return columns;
  }
  
  private parseColumn(columnText: string): ColumnDefinition | null {
    try {
      // Skip constraints and other non-column definitions
      if (/^\s*(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)/i.test(columnText)) {
        return null;
      }
      
      // Parse: column_name data_type [NOT NULL] [DEFAULT value] [COMMENT 'comment']
      const parts = columnText.trim().split(/\s+/);
      if (parts.length < 2) {
        return null;
      }
      
      const name = this.cleanIdentifier(parts[0]);
      let type = parts[1];
      
      // Handle types with length/precision like VARCHAR(255) or DECIMAL(10,2)
      let i = 2;
      if (parts[1].includes('(') && !parts[1].includes(')')) {
        // Multi-part type definition
        while (i < parts.length && !parts[i-1].includes(')')) {
          type += ' ' + parts[i];
          i++;
        }
      }
      
      let nullable = true;
      let defaultValue: string | undefined;
      let comment: string | undefined;
      
      // Parse remaining parts
      while (i < parts.length) {
        const part = parts[i].toUpperCase();
        
        if (part === 'NOT' && i + 1 < parts.length && parts[i + 1].toUpperCase() === 'NULL') {
          nullable = false;
          i += 2;
        } else if (part === 'DEFAULT') {
          i++;
          if (i < parts.length) {
            defaultValue = parts[i];
            // Handle quoted defaults
            if (defaultValue.startsWith("'") && !defaultValue.endsWith("'")) {
              while (i + 1 < parts.length && !parts[i].endsWith("'")) {
                i++;
                defaultValue += ' ' + parts[i];
              }
            }
            i++;
          }
        } else if (part === 'COMMENT') {
          i++;
          if (i < parts.length) {
            comment = parts[i];
            // Handle quoted comments
            if (comment.startsWith("'")) {
              comment = comment.slice(1);
              if (!comment.endsWith("'")) {
                while (i + 1 < parts.length && !parts[i].endsWith("'")) {
                  i++;
                  comment += ' ' + parts[i];
                }
              }
              if (comment.endsWith("'")) {
                comment = comment.slice(0, -1);
              }
            }
            i++;
          }
        } else {
          i++;
        }
      }
      
      return {
        name,
        type,
        nullable,
        defaultValue,
        comment
      };
    } catch (error) {
      console.error('Error parsing column:', error);
      return null;
    }
  }
  
  private parseParameters(parametersText: string): Array<{name: string; type: string; defaultValue?: string}> {
    if (!parametersText.trim()) {
      return [];
    }
    
    const parameters: Array<{name: string; type: string; defaultValue?: string}> = [];
    const paramParts = this.splitByComma(parametersText);
    
    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }
      
      // Parse: param_name data_type [DEFAULT value]
      const match = trimmed.match(/^(\w+)\s+([^\s]+)(?:\s+DEFAULT\s+(.+))?/i);
      if (match) {
        parameters.push({
          name: match[1],
          type: match[2],
          defaultValue: match[3]
        });
      }
    }
    
    return parameters;
  }
  
  private splitByComma(text: string): string[] {
    const parts: string[] = [];
    let current = '';
    let parenLevel = 0;
    let inQuote = false;
    let quoteChar = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (!inQuote && (char === "'" || char === '"')) {
        inQuote = true;
        quoteChar = char;
      } else if (inQuote && char === quoteChar) {
        inQuote = false;
        quoteChar = '';
      } else if (!inQuote) {
        if (char === '(') {
          parenLevel++;
        } else if (char === ')') {
          parenLevel--;
        } else if (char === ',' && parenLevel === 0) {
          parts.push(current.trim());
          current = '';
          continue;
        }
      }
      
      current += char;
    }
    
    if (current.trim()) {
      parts.push(current.trim());
    }
    
    return parts;
  }
  
  private cleanIdentifier(identifier: string): string {
    // Remove quotes and normalize
    return identifier.replace(/["`]/g, '').trim();
  }
  
  private parseFullyQualifiedName(fullName: string): {database?: string; schema?: string; name: string} {
    const parts = fullName.split('.');
    
    if (parts.length === 3) {
      return {
        database: parts[0],
        schema: parts[1],
        name: parts[2]
      };
    } else if (parts.length === 2) {
      return {
        schema: parts[0],
        name: parts[1]
      };
    } else {
      return {
        name: parts[0]
      };
    }
  }
}
