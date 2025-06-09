import "./main.css";

import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	setIcon,
	MarkdownRenderer,
} from "obsidian";
import { GraphView, VIEW_TYPE_GRAPH } from "./graph/GraphView";
import { customAlphabet } from "nanoid";
import {
	SvelteOcclusionEditorView,
	VIEW_TYPE_OCCLUSION,
} from "./occlusion/OcclusionEditorView";
import { FlashcardManager } from "./flashcard/FlashcardManager";
import {
	SvelteReviewQueueSidebarView,
	UNIFIED_VIEW_TYPE,
} from "./review/ReviewQueueSidebarView";
import { VIEW_TYPE_DRAWING } from "./drawing/DrawingView";
import { DrawingCanvasView } from "./drawing/DrawingView";
import { ChatView, VIEW_TYPE_CHAT } from "./chat/ChatEditorView";
import type { PluginNotes } from "./types";
import { OcclusionManager } from "./occlusion/OcclusionManager";
import { processMathBlocks } from "./flashcard/FlashcardManager";
import { processCustomHiddenText } from "./flashcard/FlashcardManager";

export const nanoid = customAlphabet(
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
	10
);

export function generateUUID(): string {
	return nanoid();
}

interface MyPluginSettings {
	mySetting: string;
	hiddenColor: string;
	randomizeFlashcards: boolean;
	allHidden: boolean;
	openAIApiKey: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: "default",
	hiddenColor: "#272c36",
	randomizeFlashcards: false,
	allHidden: true,
	openAIApiKey: "",
};

export interface PluginData {
	settings: MyPluginSettings;
	notes: PluginNotes;
}

class MyPluginSettingTab extends PluginSettingTab {
	plugin: MyPlugin;
	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Hidden Text Background Color")
			.setDesc("Set the background color for hidden text")
			.addText((text) =>
				text
					.setPlaceholder("Color")
					.setValue(this.plugin.settings.hiddenColor)
					.onChange(async (value) => {
						this.plugin.settings.hiddenColor = value;
						document.documentElement.style.setProperty(
							"--hidden-color",
							value
						);
						await this.plugin.savePluginData();
					})
			);

		new Setting(containerEl)
			.setName("Randomize Flashcards")
			.setDesc(
				"If enabled, flashcards will be displayed in random order."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.randomizeFlashcards)
					.onChange(async (value) => {
						this.plugin.settings.randomizeFlashcards = value;
						await this.plugin.savePluginData();
					})
			);

		new Setting(containerEl)
			.setName("OpenAI API Key")
			.setDesc("Your OpenAI API key for the Chat Assistant")
			.addText((text) =>
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.openAIApiKey || "")
					.onChange(async (value) => {
						this.plugin.settings.openAIApiKey = value;
						await this.plugin.savePluginData();

						this.app.workspace
							.getLeavesOfType(VIEW_TYPE_CHAT)
							.forEach((leaf) => {
								if (leaf.view instanceof ChatView) {
									leaf.view.notifySettingsChange();
								}
							});
					})
			);
	}
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	notes: PluginNotes = {};
	protected refreshTimeout: number | null = null;
	protected toggleHiddenRibbonEl: HTMLElement | null = null;
	public occlusionManager: OcclusionManager;
	public flashcardManager: FlashcardManager;

	async onload() {
		await this.loadPluginData();
		this.occlusionManager = new OcclusionManager(this.app, this);
		this.flashcardManager = new FlashcardManager(this);
		this.initializeUI();
		this.registerCommands();
		this.registerCustomViews();
		this.addSettingTab(new MyPluginSettingTab(this.app, this));
		this.flashcardManager.scheduleNextDueRefresh();

		this.preloadMathRenderer();

		this.registerMarkdownPostProcessor((element, context) => {
			const isFlashcard =
				element.closest("[data-flashcard-content='true']") !== null;

			if (isFlashcard) {
				processCustomHiddenText(element, true);
				this.flashcardManager.processCustomHiddenCodeBlocks(
					element,
					true
				);
			} else {
				if (!this.settings.allHidden) {
					processCustomHiddenText(element, false);
					this.flashcardManager.processCustomHiddenCodeBlocks(
						element,
						false
					);
				} else {
					processCustomHiddenText(element, true);
					this.flashcardManager.processCustomHiddenCodeBlocks(
						element,
						true
					);
				}
			}

			processMathBlocks(element);
			this.occlusionManager.processOcclusionImage(element);
		});
	}

	onunload() {
		if (this.refreshTimeout !== null) {
			clearTimeout(this.refreshTimeout);
			this.refreshTimeout = null;
		}
	}

	async loadPluginData() {
		const data = (await this.loadData()) as PluginData;
		if (data) {
			this.settings = data.settings || DEFAULT_SETTINGS;
			this.notes = data.notes || {};
		} else {
			this.settings = DEFAULT_SETTINGS;
			this.notes = {};
		}
		document.documentElement.style.setProperty(
			"--hidden-color",
			this.settings.hiddenColor
		);
	}

	async savePluginData() {
		const data: PluginData = {
			settings: this.settings,
			notes: this.notes,
		};
		await this.saveData(data);
	}

	private initializeUI(): void {
		this.addRibbonIcon("layers", "Review Flashcards", (evt: MouseEvent) => {
			evt.preventDefault();
			this.flashcardManager.showAllDueFlashcardsModal();
		}).addClass("flashcard-ribbon-icon");

		this.addRibbonIcon("dot-network", "Open Review Graph View", () => {
			this.activateView(VIEW_TYPE_GRAPH);
		});

		this.addRibbonIcon("check-square", "Review Current Note", () => {
			this.flashcardManager.showFlashcardsModal();
		});

		this.addRibbonIcon("check", "Review All", () => {
			this.flashcardManager.showAllDueFlashcardsModal();
		});

		this.toggleHiddenRibbonEl = this.addRibbonIcon(
			this.settings.allHidden ? "eye" : "eye-off",
			this.settings.allHidden
				? "Show All Hidden Content"
				: "Hide All Content",
			() => {
				this.flashcardManager.toggleAllHidden();
			}
		);

		this.addRibbonIcon("file-text", "Open Review Queue", () => {
			this.activateView(UNIFIED_VIEW_TYPE, true);
		});

		this.addRibbonIcon("image-file", "Open Occlusion Editor", () => {
			this.activateView(VIEW_TYPE_OCCLUSION, true);
		});

		this.addRibbonIcon("pencil", "Open Drawing Canvas", () => {
			const activeFile = this.app.workspace.getActiveFile();
			this.activateView(VIEW_TYPE_DRAWING, false, {
				filePath: activeFile?.path,
			});
		});

		this.addRibbonIcon("message-square", "Open Chat Assistant", () => {
			this.activateView(VIEW_TYPE_CHAT, true);
		});
	}

	private registerCommands(): void {
		this.addCommand({
			id: "open-graph-view",
			name: "Open Graph View",
			callback: () => this.activateView(VIEW_TYPE_GRAPH),
		});

		this.addCommand({
			id: "show-flashcards-modal",
			name: "Show Flashcards Modal",
			callback: () => this.flashcardManager.showAllDueFlashcardsModal(),
		});

		this.addCommand({
			id: "review-current-note",
			name: "Review Current Note",
			callback: () => this.flashcardManager.showFlashcardsModal(),
		});

		this.addCommand({
			id: "review-all-due-flashcards",
			name: "Review All",
			callback: () => this.flashcardManager.showAllDueFlashcardsModal(),
		});

		this.addCommand({
			id: "delete-all-card-wrappers",
			name: "Delete all [card][/card] wrappers",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.flashcardManager.deleteWrappers(
					editor,
					/\[card(?:=[^\]]+)?\]/,
					/\[\/card\]/,
					true,
					"Removed all [card][/card] wrappers from the note."
				);
			},
		});

		this.addCommand({
			id: "delete-card-wrappers",
			name: "Delete [card][/card] wrappers",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.flashcardManager.deleteWrappers(
					editor,
					/\[card(?:=[A-Za-z0-9]+)?\]/,
					/\[\/card\]/,
					false,
					"Removed [card][/card] wrappers.",
					"Cursor is not inside a [card]...[/card] block."
				);
			},
		});

		this.addCommand({
			id: "delete-hide-wrappers",
			name: "Delete [hide][/hide] wrappers",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.flashcardManager.deleteWrappers(
					editor,
					/\[hide(?:=\d+)?\]/,
					/\[\/hide\]/,
					false,
					"Removed [hide]...[/hide] wrappers.",
					"Cursor is not inside a [hide]...[/hide] block."
				);
			},
		});

		this.addCommand({
			id: "wrap-text-as-flashcard",
			name: "Wrap Selected Text in [card][/card]",
			editorCallback: async (editor: Editor) => {
				const selection = editor.getSelection();

				if (selection && selection.trim().length > 0) {
					editor.replaceSelection(
						`[card]\n${selection.trim()}\n[/card]`
					);
				} else {
					const cursor = editor.getCursor();
					const line = editor.getLine(cursor.line);

					if (line.trim().length > 0) {
						editor.replaceRange(
							`[card]\n${line.trim()}\n[/card]`,
							{ line: cursor.line, ch: 0 },
							{ line: cursor.line, ch: line.length }
						);
						new Notice("Current line wrapped as flashcard");
					} else {
						new Notice("Current line is empty. Nothing to wrap.");
						return;
					}
				}

				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile instanceof TFile) {
					await this.flashcardManager.syncFlashcardsForFile(
						activeFile
					);
					this.flashcardManager.refreshUnifiedQueue();
				}
			},
		});

		this.addCommand({
			id: "resync-cards-current-note",
			name: "Resync Flashcards in Current Note",
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile || !(activeFile instanceof TFile)) {
					new Notice("No active note open to sync flashcards.");
					return;
				}
				await this.flashcardManager.syncFlashcardsForFile(activeFile);
				new Notice("Flashcards resynced for the current note.");
				this.flashcardManager.refreshUnifiedQueue();
			},
		});

		this.addCommand({
			id: "sync-all-cards-in-vault",
			name: "Synchronize All Cards in Vault",
			callback: async () => {
				const markdownFiles = this.app.vault.getMarkdownFiles();
				for (const file of markdownFiles) {
					await this.flashcardManager.syncFlashcardsForFile(file);
				}
				await this.savePluginData();
				new Notice("Synchronized all cards across the vault.");
				this.flashcardManager.refreshUnifiedQueue();
			},
		});

		this.addCommand({
			id: "open-unified-queue",
			name: "Open Unified Queue",
			callback: () => this.activateView(UNIFIED_VIEW_TYPE, true),
		});

		this.addCommand({
			id: "wrap-selected-text-with-hide",
			name: "Wrap Selected Text in [hide][/hide]",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const selection = editor.getSelection();
				if (selection && selection.trim().length > 0) {
					editor.replaceSelection(`[hide]${selection}[/hide]`);
				} else {
					const cursor = editor.getCursor();
					const line = editor.getLine(cursor.line);

					if (line.trim().length > 0) {
						editor.replaceRange(
							`[hide]${line}[/hide]`,
							{ line: cursor.line, ch: 0 },
							{ line: cursor.line, ch: line.length }
						);
						new Notice("Current line wrapped in [hide][/hide]");
					} else {
						new Notice("Current line is empty. Nothing to wrap.");
					}
				}
			},
		});

		this.addCommand({
			id: "wrap-in-multiline-hide",
			name: "Wrap in multiline hide [hide][/hide]",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const selection = editor.getSelection();
				if (selection && selection.trim().length > 0) {
					editor.replaceSelection("```hide\n" + selection + "\n```");
				} else {
					const cursor = editor.getCursor();
					const line = editor.getLine(cursor.line);

					if (line.trim().length > 0) {
						editor.replaceRange(
							"```hide\n" + line + "\n```",
							{ line: cursor.line, ch: 0 },
							{ line: cursor.line, ch: line.length }
						);
						new Notice(
							"Current line wrapped in multiline hide block."
						);
					} else {
						new Notice("Current line is empty. Nothing to wrap.");
					}
				}
			},
		});

		this.addCommand({
			id: "toggle-all-hidden",
			name: "Toggle All Hidden Content",
			callback: () => this.flashcardManager.toggleAllHidden(),
		});

		this.addCommand({
			id: "open-occlusion-editor",
			name: "Open Occlusion Editor",
			callback: () => this.activateView(VIEW_TYPE_OCCLUSION, true),
		});

		this.addCommand({
			id: "open-drawing-canvas",
			name: "Open Drawing Canvas",
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();
				this.activateView(VIEW_TYPE_DRAWING, false, {
					filePath: activeFile?.path,
				});
			},
		});

		this.addCommand({
			id: "open-chat-assistant",
			name: "Open Chat Assistant",
			callback: () => this.activateView(VIEW_TYPE_CHAT, true),
		});

		this.addCommand({
			id: "split-math-block-on-equals",
			name: "Split Math Block on Equals Sign",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.flashcardManager.splitMathBlockOnEquals(editor);
			},
		});
	}

	private registerCustomViews(): void {
		this.registerView(
			UNIFIED_VIEW_TYPE,
			(leaf) => new SvelteReviewQueueSidebarView(leaf, this)
		);
		this.registerView(VIEW_TYPE_GRAPH, (leaf) => new GraphView(leaf, this));
		this.registerView(
			VIEW_TYPE_OCCLUSION,
			(leaf) => new SvelteOcclusionEditorView(leaf, this)
		);
		this.registerView(
			VIEW_TYPE_DRAWING,
			(leaf) => new DrawingCanvasView(leaf, this.app, this)
		);
		this.registerView(VIEW_TYPE_CHAT, (leaf) => new ChatView(leaf, this));
	}

	public setRefreshTimeout(callback: () => void, delay: number): number {
		if (this.refreshTimeout !== null) {
			clearTimeout(this.refreshTimeout);
			this.refreshTimeout = null;
		}
		this.refreshTimeout = window.setTimeout(callback, delay);
		return this.refreshTimeout;
	}

	public updateToggleHiddenRibbonIcon(isHidden: boolean): void {
		if (this.toggleHiddenRibbonEl) {
			this.toggleHiddenRibbonEl.empty();
			setIcon(this.toggleHiddenRibbonEl, isHidden ? "eye" : "eye-off");
			this.toggleHiddenRibbonEl.setAttribute(
				"aria-label",
				isHidden ? "Show All Hidden Content" : "Hide All Content"
			);
			this.toggleHiddenRibbonEl.setAttribute(
				"data-tooltip",
				isHidden ? "Show All Hidden Content" : "Hide All Content"
			);
		}
	}

	public async activateView(
		viewType: string,
		rightSide: boolean = false,
		state: any = {}
	): Promise<void> {
		let leaf = this.app.workspace.getLeavesOfType(viewType)[0];
		if (!leaf) {
			leaf = rightSide
				? this.app.workspace.getRightLeaf(false) ||
				  this.app.workspace.getLeaf(true)
				: this.app.workspace.getLeaf(true);
			await leaf.setViewState({
				type: viewType,
				active: true,
				state: state,
			});
		}
		this.app.workspace.revealLeaf(leaf);
	}

	private async preloadMathRenderer(): Promise<void> {
		setTimeout(async () => {
			try {
				const tempEl = document.createElement("div");
				tempEl.style.position = "absolute";
				tempEl.style.visibility = "hidden";
				tempEl.style.pointerEvents = "none";
				document.body.appendChild(tempEl);

				await MarkdownRenderer.render(
					this.app,
					"$x^2$ and $$\\int_0^1 f(x)dx$$",
					tempEl,
					"",
					this
				);

				setTimeout(() => tempEl.remove(), 500);
			} catch (e) {
				console.log("Math renderer preload attempted:", e);
			}
		}, 1000);
	}
}
