import { TFile, Notice } from "obsidian";
import OpenAI from "openai";

export enum ToolNames {
	create_new_note = "create_new_note",
	replace_document_content = "replace_document_content",
}

export interface ActionItem {
	id: string;
	type: string;
	status: "pending" | "in-progress" | "completed" | "error";
	title: string;
	description: string;
	result?: string;
	timestamp: Date;
	params?: any;
}

export interface ToolExecutionContext {
	plugin: any;
	addFileTab: (file: TFile) => void;
	selectedNotePath: string;
	setSelectedNotePath: (path: string) => void;
}

export interface ToolExecutionResult {
	success: boolean;
	result?: string;
	error?: string;
	file?: TFile;
}

export const AI_TOOLS: OpenAI.Responses.Tool[] = [
	{
		type: "function",
		name: ToolNames.create_new_note,
		description:
			"Create a new note with a specific name. Use this when the user asks to create a new note.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				noteName: {
					type: "string",
					description:
						"The name for the new note (without .md extension)",
				},
				content: {
					type: "string",
					description: "Initial content for the new note",
				},
			},
			required: ["noteName", "content"],
			additionalProperties: false,
		},
	},
	{
		type: "function",
		name: ToolNames.replace_document_content,
		description:
			"Replace the entire content of a specified file with new content.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				filePath: {
					type: "string",
					description: "The path of the file to replace content in",
				},
				content: {
					type: "string",
					description: "The new content to place in the file",
				},
			},
			required: ["filePath", "content"],
			additionalProperties: false,
		},
	},
];

export function getActionTitle(toolName: string): string {
	switch (toolName) {
		case ToolNames.create_new_note:
			return "Creating New Note";
		case ToolNames.replace_document_content:
			return "Updating Document";
		default:
			return "Executing Action";
	}
}

export function getActionDescription(toolName: string): string {
	switch (toolName) {
		case ToolNames.create_new_note:
			return "Generating content and creating a new note file";
		case ToolNames.replace_document_content:
			return "Replacing the entire content of the specified document";
		default:
			return "Performing the requested action";
	}
}

export function replaceKatexWithMathJax(input: string): string {
	const displayRegex = /\\\[\s*([\s\S]*?)\s*\\\]/g;
	const inlineRegex = /\\\(\s*([\s\S]*?)\s*\\\)/g;

	return input
		.replace(displayRegex, (_match, content) => {
			return `$$\n${content.trim()}\n$$`;
		})
		.replace(inlineRegex, (_match, content) => {
			return `$${content.trim()}$`;
		});
}

export async function createNoteWithName(
	noteName: string,
	initialContent: string,
	context: ToolExecutionContext
): Promise<TFile | null> {
	try {
		const { plugin } = context;

		const newNoteFolder = plugin.app.vault.getConfig("newFileLocation");
		let path = noteName;

		if (newNoteFolder === "folder") {
			const configuredFolder =
				plugin.app.vault.getConfig("newFileFolderPath");
			if (configuredFolder) {
				const folderPath = configuredFolder
					.replace(/\\/g, "/")
					.replace(/\/+/g, "/");

				try {
					const folders = folderPath
						.split("/")
						.filter((p: string) => p.length > 0);
					let currentPath = "";

					for (const folder of folders) {
						currentPath += folder + "/";
						try {
							await plugin.app.vault.createFolder(currentPath);
						} catch (e) {}
					}
				} catch (e) {
					console.warn("Error creating folders:", e);
				}

				path = `${configuredFolder}/${noteName}`;
			}
		} else if (newNoteFolder === "current") {
			const activeFile = plugin.app.workspace.getActiveFile();
			if (activeFile && activeFile.parent) {
				const folderPath = activeFile.parent.path;
				if (folderPath && folderPath !== "/") {
					path = `${folderPath}/${noteName}`;
				}
			}
		}

		const newFile = await plugin.app.vault.create(path, initialContent);

		context.addFileTab(newFile);

		await plugin.app.workspace.getLeaf(true).openFile(newFile);

		context.setSelectedNotePath(newFile.path);

		return newFile;
	} catch (error) {
		console.error("Error creating new note:", error);
		throw error;
	}
}

export async function executeCreateNewNote(
	params: { noteName: string; content: string },
	context: ToolExecutionContext
): Promise<ToolExecutionResult> {
	try {
		const noteNameWithExt = params.noteName.endsWith(".md")
			? params.noteName
			: `${params.noteName}.md`;

		const newFile = await createNoteWithName(
			noteNameWithExt,
			replaceKatexWithMathJax(params.content),
			context
		);

		if (newFile) {
			new Notice(`✅ Created note "${newFile.basename}"`);
			return {
				success: true,
				result: `Created note "${newFile.basename}"`,
				file: newFile,
			};
		} else {
			return {
				success: false,
				error: "Failed to create note",
			};
		}
	} catch (error) {
		const errorMessage = (error as Error).message;
		new Notice(`❌ Error creating note: ${errorMessage}`);
		return {
			success: false,
			error: `Error creating note: ${errorMessage}`,
		};
	}
}

export async function executeReplaceDocumentContent(
	params: { filePath: string; content: string },
	context: ToolExecutionContext
): Promise<ToolExecutionResult> {
	try {
		const { plugin } = context;
		const targetFile = plugin.app.vault.getAbstractFileByPath(
			params.filePath
		);

		if (targetFile instanceof TFile) {
			await plugin.app.vault.modify(
				targetFile,
				replaceKatexWithMathJax(params.content)
			);

			new Notice(`✅ Updated "${targetFile.basename}"`);
			return {
				success: true,
				result: `Updated "${targetFile.basename}"`,
				file: targetFile,
			};
		} else {
			const errorMessage = `Could not find file "${params.filePath}"`;
			new Notice(`❌ ${errorMessage}`);
			return {
				success: false,
				error: errorMessage,
			};
		}
	} catch (error) {
		const errorMessage = (error as Error).message;
		new Notice(`❌ Error updating document: ${errorMessage}`);
		return {
			success: false,
			error: `Error updating document: ${errorMessage}`,
		};
	}
}

export async function executeAITool(
	toolName: string,
	params: any,
	context: ToolExecutionContext
): Promise<ToolExecutionResult> {
	switch (toolName) {
		case ToolNames.create_new_note:
			return await executeCreateNewNote(params, context);
		case ToolNames.replace_document_content:
			return await executeReplaceDocumentContent(params, context);
		default:
			return {
				success: false,
				error: `Unknown tool: ${toolName}`,
			};
	}
}

export function createActionItem(
	toolName: string,
	status: ActionItem["status"] = "in-progress"
): ActionItem {
	return {
		id: `${toolName}-${Date.now()}`,
		type: toolName,
		status,
		title: getActionTitle(toolName),
		description: getActionDescription(toolName),
		timestamp: new Date(),
	};
}

export function updateActionItem(
	action: ActionItem,
	result: ToolExecutionResult,
	params?: any
): ActionItem {
	return {
		...action,
		status: result.success ? "completed" : "error",
		result: result.success ? result.result : result.error,
		params: result.success ? params : undefined,
	};
}
