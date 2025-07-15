// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { SnowflakeDDLParser } from './sqlParser';
import { TerraformConverter } from './terraformConverter';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "sf2tf" is now active!');

	const parser = new SnowflakeDDLParser();
	const converter = new TerraformConverter();

	// Command to convert selected SQL to Terraform
	const convertSelection = vscode.commands.registerCommand('sf2tf.convertSelection', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}

		const selection = editor.selection;
		const selectedText = editor.document.getText(selection);
		
		if (!selectedText.trim()) {
			vscode.window.showErrorMessage('No text selected');
			return;
		}

		try {
			const ddlObjects = parser.parseDDL(selectedText);
			if (ddlObjects.length === 0) {
				vscode.window.showWarningMessage('No valid DDL statements found in selection');
				return;
			}

			const terraformResources = converter.convertToTerraform(ddlObjects);
			const terraformContent = converter.generateTerraformFile(terraformResources);

			// Create new document with Terraform content
			const doc = await vscode.workspace.openTextDocument({
				content: terraformContent,
				language: 'hcl'
			});
			await vscode.window.showTextDocument(doc);

			vscode.window.showInformationMessage(`Converted ${ddlObjects.length} DDL statement(s) to Terraform`);
		} catch (error) {
			vscode.window.showErrorMessage(`Error converting SQL: ${error}`);
		}
	});

	// Command to convert entire file to Terraform
	const convertFile = vscode.commands.registerCommand('sf2tf.convertFile', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}

		const fullText = editor.document.getText();
		
		if (!fullText.trim()) {
			vscode.window.showErrorMessage('File is empty');
			return;
		}

		try {
			const ddlObjects = parser.parseDDL(fullText);
			if (ddlObjects.length === 0) {
				vscode.window.showWarningMessage('No valid DDL statements found in file');
				return;
			}

			const terraformResources = converter.convertToTerraform(ddlObjects);
			const terraformContent = converter.generateTerraformFile(terraformResources);

			// Suggest filename based on current file
			const currentFileName = editor.document.fileName;
			const baseName = currentFileName.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || 'converted';
			const suggestedName = `${baseName}.tf`;

			// Create new document with Terraform content
			const doc = await vscode.workspace.openTextDocument({
				content: terraformContent,
				language: 'hcl'
			});
			await vscode.window.showTextDocument(doc);

			// Suggest saving the file
			const saveChoice = await vscode.window.showInformationMessage(
				`Converted ${ddlObjects.length} DDL statement(s) to Terraform. Save as ${suggestedName}?`,
				'Save As...',
				'Don\'t Save'
			);

			if (saveChoice === 'Save As...') {
				const uri = await vscode.window.showSaveDialog({
					defaultUri: vscode.Uri.file(suggestedName),
					filters: {
						'Terraform Files': ['tf'],
						'All Files': ['*']
					}
				});

				if (uri) {
					await vscode.workspace.fs.writeFile(uri, Buffer.from(terraformContent, 'utf8'));
					vscode.window.showInformationMessage(`Terraform file saved: ${uri.fsPath}`);
				}
			}

		} catch (error) {
			vscode.window.showErrorMessage(`Error converting SQL: ${error}`);
		}
	});

	// Command to preview conversion without creating a new document
	const previewConversion = vscode.commands.registerCommand('sf2tf.previewConversion', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}

		const selection = editor.selection;
		const selectedText = editor.document.getText(selection);
		
		if (!selectedText.trim()) {
			vscode.window.showErrorMessage('No text selected');
			return;
		}

		try {
			const ddlObjects = parser.parseDDL(selectedText);
			if (ddlObjects.length === 0) {
				vscode.window.showWarningMessage('No valid DDL statements found in selection');
				return;
			}

			const terraformResources = converter.convertToTerraform(ddlObjects);
			const terraformContent = converter.generateTerraformFile(terraformResources);

			// Show preview in a new panel
			const panel = vscode.window.createWebviewPanel(
				'terraformPreview',
				'Terraform Preview',
				vscode.ViewColumn.Beside,
				{
					enableScripts: true
				}
			);

			panel.webview.html = getWebviewContent(terraformContent, ddlObjects.length);

		} catch (error) {
			vscode.window.showErrorMessage(`Error converting SQL: ${error}`);
		}
	});

	// Command to convert all SQL files in a folder and its subfolders to Terraform
	const convertFolder = vscode.commands.registerCommand('sf2tf.convertFolder', async (uri?: vscode.Uri) => {
		let folderUri: vscode.Uri | undefined;

		if (uri) {
			// Called from explorer context menu
			folderUri = uri;
		} else {
			// Called from command palette, show folder picker
			const options: vscode.OpenDialogOptions = {
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: 'Select Folder'
			};

			const result = await vscode.window.showOpenDialog(options);
			if (result && result.length > 0) {
				folderUri = result[0];
			}
		}

		if (!folderUri) {
			vscode.window.showErrorMessage('No folder selected');
			return;
		}

		try {
			// Show progress indicator
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Converting SQL files to Terraform',
				cancellable: true
			}, async (progress, token) => {
				const sqlFiles = await findSqlFiles(folderUri!);
				
				if (sqlFiles.length === 0) {
					vscode.window.showWarningMessage('No SQL files found in the selected folder');
					return;
				}

				progress.report({ message: `Found ${sqlFiles.length} SQL file(s)` });

				let convertedFiles = 0;
				let totalObjects = 0;
				const errors: string[] = [];

				for (let i = 0; i < sqlFiles.length; i++) {
					if (token.isCancellationRequested) {
						break;
					}

					const sqlFile = sqlFiles[i];
					const fileName = sqlFile.fsPath.split(/[/\\]/).pop() || 'unknown';
					
					progress.report({ 
						message: `Converting ${fileName} (${i + 1}/${sqlFiles.length})`,
						increment: (100 / sqlFiles.length) * 0.5
					});

					try {
						const content = await vscode.workspace.fs.readFile(sqlFile);
						const sqlContent = Buffer.from(content).toString('utf8');

						if (sqlContent.trim()) {
							const ddlObjects = parser.parseDDL(sqlContent);
							
							if (ddlObjects.length > 0) {
								const terraformResources = converter.convertToTerraform(ddlObjects);
								const terraformContent = converter.generateTerraformFile(terraformResources);

								// Generate output file path
								const relativePath = vscode.workspace.asRelativePath(sqlFile);
								const outputPath = sqlFile.fsPath.replace(/\.sql$/i, '.tf');
								const outputUri = vscode.Uri.file(outputPath);

								// Write the Terraform file
								await vscode.workspace.fs.writeFile(outputUri, Buffer.from(terraformContent, 'utf8'));
								
								convertedFiles++;
								totalObjects += ddlObjects.length;
							}
						}
					} catch (error) {
						errors.push(`${fileName}: ${error}`);
					}

					progress.report({ 
						increment: (100 / sqlFiles.length) * 0.5
					});
				}

				if (token.isCancellationRequested) {
					vscode.window.showWarningMessage('Conversion cancelled by user');
					return;
				}

				// Show results
				if (convertedFiles > 0) {
					const message = `Successfully converted ${convertedFiles} SQL file(s) with ${totalObjects} DDL object(s) to Terraform`;
					if (errors.length > 0) {
						const showErrors = await vscode.window.showInformationMessage(
							`${message}. ${errors.length} file(s) had errors.`,
							'Show Errors'
						);
						if (showErrors === 'Show Errors') {
							const errorPanel = vscode.window.createOutputChannel('SF2TF Conversion Errors');
							errorPanel.appendLine('Conversion Errors:');
							errors.forEach(error => errorPanel.appendLine(`- ${error}`));
							errorPanel.show();
						}
					} else {
						vscode.window.showInformationMessage(message);
					}
				} else {
					if (errors.length > 0) {
						vscode.window.showErrorMessage(`No files converted. ${errors.length} error(s) occurred.`);
					} else {
						vscode.window.showWarningMessage('No valid DDL statements found in any SQL files');
					}
				}
			});

		} catch (error) {
			vscode.window.showErrorMessage(`Error during folder conversion: ${error}`);
		}
	});

	context.subscriptions.push(convertSelection, convertFile, previewConversion, convertFolder);
}

// Helper function to recursively find all SQL files in a folder and its subfolders
async function findSqlFiles(folderUri: vscode.Uri): Promise<vscode.Uri[]> {
	const sqlFiles: vscode.Uri[] = [];
	
	try {
		const entries = await vscode.workspace.fs.readDirectory(folderUri);
		
		for (const [name, type] of entries) {
			const entryUri = vscode.Uri.joinPath(folderUri, name);
			
			if (type === vscode.FileType.Directory) {
				// Recursively search subdirectories
				const subFiles = await findSqlFiles(entryUri);
				sqlFiles.push(...subFiles);
			} else if (type === vscode.FileType.File && name.toLowerCase().endsWith('.sql')) {
				sqlFiles.push(entryUri);
			}
		}
	} catch (error) {
		console.error(`Error reading directory ${folderUri.fsPath}:`, error);
	}
	
	return sqlFiles;
}

function getWebviewContent(terraformContent: string, objectCount: number): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terraform Preview</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .header {
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .stats {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 10px;
        }
        .code-container {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 15px;
            overflow-x: auto;
        }
        .code {
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.4;
            white-space: pre;
            margin: 0;
        }
        .keyword {
            color: var(--vscode-symbolIcon-keywordForeground, #569cd6);
        }
        .string {
            color: var(--vscode-symbolIcon-stringForeground, #ce9178);
        }
        .comment {
            color: var(--vscode-symbolIcon-commentForeground, #6a9955);
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Terraform Conversion Preview</h2>
        <div class="stats">Converted ${objectCount} DDL object(s) to Terraform configuration</div>
    </div>
    <div class="code-container">
        <pre class="code">${escapeHtml(terraformContent)}</pre>
    </div>
</body>
</html>`;
}

function escapeHtml(unsafe: string): string {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

// This method is called when your extension is deactivated
export function deactivate() {}
