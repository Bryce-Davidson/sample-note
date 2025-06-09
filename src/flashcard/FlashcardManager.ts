import { TFile, Notice, Editor, MarkdownRenderer, Platform } from "obsidian";
import SampleNotePlugin, { nanoid } from "../main";
import type { CardState, Flashcard, CardMetadata } from "../types";
import { createFlashcardModal } from "./FlashcardModalView";
import {
	SvelteReviewQueueSidebarView,
	UNIFIED_VIEW_TYPE,
} from "../review/ReviewQueueSidebarView";

export class FlashcardManager {
	private plugin: SampleNotePlugin;

	constructor(plugin: SampleNotePlugin) {
		this.plugin = plugin;
		this.registerEvents();
		this.registerMarkdownPostProcessor();
	}

	private registerMarkdownPostProcessor(): void {
		this.plugin.registerMarkdownPostProcessor((el: HTMLElement) => {
			const textContent = el.textContent || "";
			const cleanedContent = textContent.replace(
				/\[\/?card(?:=[^\]]+)?\]/g,
				""
			);
			if (textContent !== cleanedContent) {
				const textNode = document.createTextNode(cleanedContent);
				while (el.firstChild) {
					el.removeChild(el.firstChild);
				}
				el.appendChild(textNode);
			}
		});
	}

	private registerEvents(): void {
		this.plugin.registerEvent(
			this.plugin.app.workspace.on("file-open", async (file: TFile) => {
				if (file && file instanceof TFile && file.extension === "md") {
					await this.syncFlashcardsForFile(file);
					this.refreshUnifiedQueue();

					const now = new Date().toISOString();
					if (!this.plugin.notes[file.path]) {
						this.plugin.notes[file.path] = {
							cards: {},
							data: { noteVisitLog: [] },
						};
					}
					this.plugin.notes[file.path].data.noteVisitLog.push(now);
					this.plugin.savePluginData();
				}
			})
		);

		this.plugin.registerEvent(
			this.plugin.app.vault.on(
				"rename",
				(file: TFile, oldPath: string) => {
					if (this.plugin.notes[oldPath]) {
						this.plugin.notes[file.path] =
							this.plugin.notes[oldPath];
						delete this.plugin.notes[oldPath];
					}

					this.plugin.savePluginData();
					this.refreshUnifiedQueue();
					this.scheduleNextDueRefresh();
				}
			)
		);

		this.plugin.registerEvent(
			this.plugin.app.vault.on("delete", (file: TFile) => {
				delete this.plugin.notes[file.path];
				this.plugin.savePluginData();
				this.refreshUnifiedQueue();
				this.scheduleNextDueRefresh();
			})
		);
	}

	async showFlashcardsModal() {
		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file open.");
			return;
		}
		let flashcards = await this.syncFlashcardsForFile(activeFile);
		if (this.plugin.settings.randomizeFlashcards) {
			flashcards = shuffleArray(flashcards);
		}
		if (flashcards.length > 0) {
			createFlashcardModal(
				this.plugin.app,
				flashcards,
				this.plugin,
				true
			).open();
		} else {
			new Notice(
				"No flashcards found in this file. Create flashcards using [card] and [/card] tags."
			);
		}
	}

	async showAllDueFlashcardsModal() {
		const loadingNotice = new Notice("Preparing flashcards...", 0);

		try {
			const now = new Date();

			const cardMetadata: CardMetadata[] = [];

			for (const filePath in this.plugin.notes) {
				for (const cardUUID in this.plugin.notes[filePath].cards) {
					const card = this.plugin.notes[filePath].cards[cardUUID];
					if (
						card.active &&
						card.nextReviewDate &&
						new Date(card.nextReviewDate) <= now
					) {
						cardMetadata.push({
							uuid: cardUUID,
							filePath: filePath,
							cardTitle: card.cardTitle,
							nextReviewDate: card.nextReviewDate,
							ef: card.ef,
							line: card.line,
						});
					}
				}
			}

			if (cardMetadata.length === 0) {
				for (const filePath in this.plugin.notes) {
					for (const cardUUID in this.plugin.notes[filePath].cards) {
						const card =
							this.plugin.notes[filePath].cards[cardUUID];
						if (
							card.active &&
							card.nextReviewDate &&
							new Date(card.nextReviewDate) > now
						) {
							cardMetadata.push({
								uuid: cardUUID,
								filePath: filePath,
								cardTitle: card.cardTitle,
								nextReviewDate: card.nextReviewDate,
								ef: card.ef,
								line: card.line,
							});
						}
					}
				}

				if (cardMetadata.length > 0) {
					new Notice(
						"No due flashcards; starting scheduled flashcards review.",
						3000
					);
				}
			}

			cardMetadata.sort((a, b) => {
				const aDate = a.nextReviewDate
					? new Date(a.nextReviewDate).getTime()
					: 0;
				const bDate = b.nextReviewDate
					? new Date(b.nextReviewDate).getTime()
					: 0;
				if (aDate !== bDate) return aDate - bDate;
				return (a.ef || 0) - (b.ef || 0);
			});

			if (this.plugin.settings.randomizeFlashcards) {
				shuffleArray(cardMetadata);
			}

			if (cardMetadata.length === 0) {
				loadingNotice.hide();
				new Notice("No flashcards due or scheduled for review.");
				return;
			}

			const initialBatch: Flashcard[] = [];

			const batchSize = Math.min(10, cardMetadata.length);

			for (let i = 0; i < batchSize; i++) {
				const metadata = cardMetadata[i];
				const card =
					this.plugin.notes[metadata.filePath]?.cards[metadata.uuid];
				if (!card) continue;

				const file = this.plugin.app.vault.getAbstractFileByPath(
					metadata.filePath
				);
				const noteTitle =
					file instanceof TFile ? file.basename : "Unknown Note";

				initialBatch.push({
					uuid: metadata.uuid,
					content: card.cardContent,
					noteTitle,
					filePath: metadata.filePath,
					cardTitle: card.cardTitle,
					line: metadata.line,
					nextReviewDate: card.nextReviewDate,
					ef: card.ef,
				});
			}

			const loadCardBatch = async (
				metadataBatch: CardMetadata[]
			): Promise<Flashcard[]> => {
				const flashcards: Flashcard[] = [];

				for (const item of metadataBatch) {
					const card =
						this.plugin.notes[item.filePath]?.cards[item.uuid];
					if (!card) continue;

					const file = this.plugin.app.vault.getAbstractFileByPath(
						item.filePath
					);
					flashcards.push({
						uuid: item.uuid,
						content: card.cardContent,
						noteTitle:
							file instanceof TFile
								? file.basename
								: "Unknown Note",
						filePath: item.filePath,
						cardTitle: card.cardTitle,
						line: item.line,
						nextReviewDate: card.nextReviewDate,
						ef: card.ef,
					});
				}

				return flashcards;
			};

			const loaderProxy = {
				async loadCardBatch(
					metadata: CardMetadata[]
				): Promise<Flashcard[]> {
					return await loadCardBatch(metadata);
				},
			};

			loadingNotice.hide();

			if (initialBatch.length > 0) {
				createFlashcardModal(
					this.plugin.app,
					initialBatch,
					this.plugin,
					true,
					cardMetadata,
					loaderProxy as any
				).open();
			} else {
				new Notice("No flashcards due or scheduled for review.");
			}
		} catch (error) {
			loadingNotice.hide();

			let errorMessage = "Error preparing flashcards: ";

			if (error instanceof Error) {
				if (
					error.message.includes("ENOENT") ||
					error.message.includes("not found")
				) {
					errorMessage =
						"Some flashcard files could not be found. They may have been moved or deleted.";
				} else if (
					error.message.includes("permission") ||
					error.message.includes("EACCES")
				) {
					errorMessage =
						"Permission denied: Cannot access some flashcard files.";
				} else if (
					error.message.includes("parse") ||
					error.message.includes("syntax")
				) {
					errorMessage =
						"Some files contain invalid syntax that prevents loading flashcards.";
				} else if (
					error.message.includes("memory") ||
					error.message.includes("heap")
				) {
					errorMessage =
						"Too many flashcards to load at once. Try reviewing fewer cards.";
				} else {
					errorMessage += error.message;
				}
			} else {
				errorMessage += String(error);
			}

			new Notice(errorMessage);
			console.error("Error in showAllDueFlashcardsModal:", error);
		}
	}

	async syncFlashcardsForFile(file: TFile): Promise<Flashcard[]> {
		// Only process markdown files
		if (file.extension !== "md") {
			return [];
		}

		try {
			let content: string;

			try {
				content = await this.plugin.app.vault.read(file);
			} catch (readError) {
				if (Platform.isMobile) {
					console.warn(
						"Initial file read failed on mobile, retrying...",
						readError
					);

					await new Promise((resolve) => setTimeout(resolve, 100));

					try {
						content = await this.plugin.app.vault.read(file);
					} catch (retryError) {
						console.warn(
							"Retry failed, attempting adapter read...",
							retryError
						);

						try {
							const adapter = this.plugin.app.vault.adapter;
							if ("read" in adapter) {
								content = await adapter.read(file.path);
							} else {
								throw retryError;
							}
						} catch (adapterError) {
							throw new Error(
								`Unable to read file after multiple attempts: ${adapterError.message}`
							);
						}
					}
				} else {
					throw readError;
				}
			}

			// Normalize content for cross-platform compatibility
			if (Platform.isMobile) {
				// Remove BOM if present
				if (content.charCodeAt(0) === 0xfeff) {
					content = content.slice(1);
				}

				// Normalize line endings
				content = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

				// Remove any null characters that might cause issues
				content = content.replace(/\0/g, "");
			}

			const flashcards: Flashcard[] = [];
			const now = new Date().toISOString();

			if (!this.plugin.notes[file.path]) {
				this.plugin.notes[file.path] = {
					cards: {},
					data: { noteVisitLog: [] },
				};
			}

			const fileCards = this.plugin.notes[file.path].cards;
			let newCardAdded = false;
			const allValidChildCardUUIDs: string[] = [];
			let contentModified = false;

			const lines = content.split("\n");
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const cardMatch = line.match(/\[card(?:=([A-Za-z0-9]+))?\]/);

				if (cardMatch) {
					const existingUUID = cardMatch[1];
					const cardUUID = existingUUID || nanoid();
					let cardContent = "";
					let j = i + 1;

					while (j < lines.length) {
						if (lines[j].includes("[/card]")) {
							break;
						}
						cardContent += lines[j] + "\n";
						j++;
					}

					const firstLine = cardContent.split("\n")[0];
					const cardTitle = firstLine.trim();

					const flashcard: Flashcard = {
						uuid: cardUUID,
						content: cardContent.trim(),
						noteTitle: file.basename,
						filePath: file.path,
						cardTitle: cardTitle,
						line: i + 1,
					};

					flashcards.push(flashcard);

					if (!fileCards[flashcard.uuid]) {
						newCardAdded = true;
						fileCards[flashcard.uuid] = {
							cardUUID: flashcard.uuid,
							cardContent: flashcard.content,
							repetition: 0,
							interval: 0,
							ef: 2.5,
							lastReviewDate: now,
							createdAt: now,
							nextReviewDate: addMinutes(
								new Date(now),
								LEARNING_STEPS[0]
							).toISOString(),
							active: true,
							efHistory: [
								{
									timestamp: now,
									ef: 2.5,
									rating: 3,
								},
							],
							cardTitle: flashcard.cardTitle,
							line: flashcard.line,
						};
						new Notice(
							`Flashcard "${
								(flashcard.cardTitle || "").length > 20
									? (flashcard.cardTitle || "").substring(
											0,
											20
									  ) + "..."
									: flashcard.cardTitle || "Untitled"
							}" created.`
						);
					} else {
						const existingCard = fileCards[flashcard.uuid];
						const contentChanged =
							existingCard.cardContent !== flashcard.content;
						const titleChanged =
							existingCard.cardTitle !== flashcard.cardTitle;

						if (
							contentChanged ||
							titleChanged ||
							existingCard.line !== flashcard.line
						) {
							newCardAdded = true;
							existingCard.cardContent = flashcard.content;
							existingCard.cardTitle = flashcard.cardTitle;
							existingCard.line = flashcard.line;

							if (contentChanged || titleChanged) {
								new Notice(
									`Flashcard "${
										(flashcard.cardTitle || "").length > 20
											? (
													flashcard.cardTitle || ""
											  ).substring(0, 20) + "..."
											: flashcard.cardTitle || "Untitled"
									}" updated.`
								);
							}
						}
					}

					if (!existingUUID) {
						contentModified = true;
						lines[i] = `[card=${cardUUID}]`;
					}
				}
			}

			const validCardUUIDs = new Set([
				...flashcards.map((f) => f.uuid),
				...allValidChildCardUUIDs,
			]);

			for (const cardUUID in fileCards) {
				if (!validCardUUIDs.has(cardUUID)) {
					const deletedCard = fileCards[cardUUID];
					delete fileCards[cardUUID];
					newCardAdded = true;
					new Notice(
						`Flashcard "${
							(deletedCard.cardTitle || "").length > 20
								? (deletedCard.cardTitle || "").substring(
										0,
										20
								  ) + "..."
								: deletedCard.cardTitle || "Untitled"
						}" deleted.`
					);
				}
			}

			if (contentModified) {
				content = lines.join("\n");
				await this.plugin.app.vault.modify(file, content);
			}

			if (newCardAdded) {
				await this.plugin.savePluginData();
			}

			return flashcards;
		} catch (error) {
			console.error("Error syncing flashcards:", error);

			let errorMessage = `Error syncing flashcards in "${file.name}": `;

			if (error instanceof Error) {
				if (
					Platform.isMobile &&
					(error.message.includes("correct format") ||
						error.message.includes("couldn't be opened") ||
						error.message.includes("format"))
				) {
					errorMessage = `File encoding issue detected in "${file.name}". The file may contain special characters that cannot be read on mobile. Try editing and saving the file again.`;
				} else if (
					error.message.includes("ENOENT") ||
					error.message.includes("not found")
				) {
					errorMessage = `File "${file.name}" not found or cannot be accessed.`;
				} else if (
					error.message.includes("permission") ||
					error.message.includes("EACCES")
				) {
					errorMessage = `Permission denied: Cannot read or modify "${file.name}".`;
				} else if (error.message.includes("EISDIR")) {
					errorMessage = `Cannot sync flashcards: "${file.name}" is a directory, not a file.`;
				} else if (
					error.message.includes("parse") ||
					error.message.includes("syntax")
				) {
					errorMessage = `File "${file.name}" contains invalid syntax that prevents flashcard parsing.`;
				} else if (
					Platform.isMobile &&
					error.message.includes(
						"Unable to read file after multiple attempts"
					)
				) {
					errorMessage = `Unable to access "${file.name}" on mobile. Please ensure the file is synced and try again.`;
				} else {
					errorMessage += error.message;
				}
			} else {
				errorMessage += String(error);
			}

			new Notice(errorMessage);
			return [];
		}
	}

	/**
	 * Generic method to delete wrappers from content
	 * @param editor The editor instance
	 * @param startTag The opening tag pattern (regex or string)
	 * @param endTag The closing tag pattern (regex or string)
	 * @param entireDocument Whether to modify the entire document or just around cursor
	 * @param successMessage Message to show on successful deletion
	 * @param failMessage Message to show if no matches found
	 */
	public deleteWrappers(
		editor: Editor,
		startTag: string | RegExp,
		endTag: string | RegExp,
		entireDocument: boolean = false,
		successMessage: string = "Removed wrappers.",
		failMessage: string = "No matching wrappers found."
	) {
		if (entireDocument) {
			const content = editor.getValue();
			const startTagPattern =
				startTag instanceof RegExp
					? startTag
					: new RegExp(this.escapeRegExp(startTag), "g");
			const endTagPattern =
				endTag instanceof RegExp
					? endTag
					: new RegExp(this.escapeRegExp(endTag), "g");

			const fullPattern = new RegExp(
				`${startTagPattern.source}([\\s\\S]*?)${endTagPattern.source}`,
				"g"
			);
			const updatedContent = content.replace(fullPattern, "$1");

			if (content !== updatedContent) {
				editor.setValue(updatedContent);
				new Notice(successMessage);
			} else {
				new Notice(failMessage);
			}
			return;
		}

		const cursor = editor.getCursor();
		const content = editor.getValue();
		const cursorOffset = editor.posToOffset(cursor);

		const startPattern =
			startTag instanceof RegExp
				? startTag
				: new RegExp(this.escapeRegExp(startTag), "g");
		const endPattern =
			endTag instanceof RegExp
				? endTag
				: new RegExp(this.escapeRegExp(endTag), "g");

		let startMatches: Array<{ index: number; match: string }> = [];
		let match;
		const startRegex = new RegExp(startPattern.source, "g");
		while ((match = startRegex.exec(content)) !== null) {
			startMatches.push({ index: match.index, match: match[0] });
		}

		let endMatches: Array<{ index: number; match: string }> = [];
		const endRegex = new RegExp(endPattern.source, "g");
		while ((match = endRegex.exec(content)) !== null) {
			endMatches.push({ index: match.index, match: match[0] });
		}

		let foundStart = null;
		let foundEnd = null;

		for (const startMatch of startMatches) {
			for (const endMatch of endMatches) {
				if (endMatch.index > startMatch.index) {
					if (
						cursorOffset >= startMatch.index &&
						cursorOffset <= endMatch.index + endMatch.match.length
					) {
						foundStart = startMatch;
						foundEnd = endMatch;
						break;
					}
				}
			}
			if (foundStart && foundEnd) break;
		}

		if (!foundStart || !foundEnd) {
			new Notice(failMessage);
			return;
		}

		const beforeStart = content.substring(0, foundStart.index);
		const betweenTags = content.substring(
			foundStart.index + foundStart.match.length,
			foundEnd.index
		);
		const afterEnd = content.substring(
			foundEnd.index + foundEnd.match.length
		);

		const newContent = beforeStart + betweenTags + afterEnd;

		editor.setValue(newContent);

		const newCursorOffset =
			cursorOffset > foundStart.index
				? cursorOffset - foundStart.match.length
				: cursorOffset;
		editor.setCursor(editor.offsetToPos(newCursorOffset));

		new Notice(successMessage);
	}

	private escapeRegExp(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	public scheduleNextDueRefresh(): void {
		const now = new Date();
		let earliestTime: number | null = null;
		for (const note of Object.values(this.plugin.notes)) {
			for (const card of Object.values(note.cards)) {
				if (card.active && card.nextReviewDate) {
					const nextTime = new Date(card.nextReviewDate).getTime();
					if (
						nextTime > now.getTime() &&
						(earliestTime === null || nextTime < earliestTime)
					) {
						earliestTime = nextTime;
					}
				}
			}
		}
		if (earliestTime !== null) {
			const delay = earliestTime - now.getTime() + 100;
			this.plugin.setRefreshTimeout(() => {
				this.refreshUnifiedQueue();
				this.scheduleNextDueRefresh();
			}, delay);
		}
	}

	public toggleAllHidden(): void {
		this.plugin.settings.allHidden = !this.plugin.settings.allHidden;

		this.plugin.updateToggleHiddenRibbonIcon(
			this.plugin.settings.allHidden
		);

		this.plugin.savePluginData();

		const textEls = document.querySelectorAll(
			".sample-note-hidable-element"
		);
		if (!this.plugin.settings.allHidden) {
			textEls.forEach((el) =>
				el.classList.remove("sample-note-is-hidden")
			);
		} else {
			textEls.forEach((el) => el.classList.add("sample-note-is-hidden"));
		}

		this.plugin.occlusionManager.refreshOcclusionElements();
	}

	public processCustomHiddenCodeBlocks(
		rootEl: HTMLElement,
		hidden: boolean = true
	): void {
		const codeBlocks = rootEl.querySelectorAll(
			"pre code[class^='language-hide']"
		);
		codeBlocks.forEach((codeBlock) => {
			let group: string | null = null;
			codeBlock.classList.forEach((cls) => {
				const match = cls.match(/^language-hide=(\d+)$/);
				if (match) {
					group = match[1];
				}
			});
			const source = codeBlock.textContent || "";
			const container = document.createElement("div");
			container.classList.add("sample-note-hidable-element");
			if (group) {
				container.classList.add("group-hide");
				container.setAttribute("data-group", group);
			}

			if (hidden) {
				container.classList.add("sample-note-is-hidden");
			}

			MarkdownRenderer.render(
				this.plugin.app,
				source,
				container,
				"",
				this.plugin
			);

			container.addEventListener("click", function () {
				if (container.classList.contains("group-hide")) {
					const grp = container.getAttribute("data-group");
					if (grp) {
						const groupElements = document.querySelectorAll(
							`.group-hide[data-group="${grp}"]`
						);
						const isHidden = groupElements[0].classList.contains(
							"sample-note-is-hidden"
						);
						groupElements.forEach((elem) => {
							if (isHidden) {
								elem.classList.remove("sample-note-is-hidden");
							} else {
								elem.classList.add("sample-note-is-hidden");
							}
						});
					}
				} else {
					container.classList.toggle("sample-note-is-hidden");
				}
			});

			const pre = codeBlock.parentElement;
			if (pre && pre.parentElement) {
				pre.parentElement.replaceChild(container, pre);
			}
		});
	}

	public splitMathBlockOnEquals(editor: Editor): void {
		const cursor = editor.getCursor();
		const content = editor.getValue();

		const mathBlockRegex = /\$\$([^$]+?)\$\$/g;
		let match;
		let targetMatch = null;
		let targetStart = -1;
		let targetEnd = -1;

		const cursorOffset = editor.posToOffset(cursor);

		while ((match = mathBlockRegex.exec(content)) !== null) {
			const matchStart = match.index;
			const matchEnd = match.index + match[0].length;

			if (cursorOffset >= matchStart && cursorOffset <= matchEnd) {
				targetMatch = match;
				targetStart = matchStart;
				targetEnd = matchEnd;
				break;
			}
		}

		if (!targetMatch) {
			new Notice("Cursor is not within a math block.");
			return;
		}

		const mathContent = targetMatch[1];

		const equalIndex = mathContent.indexOf("=");
		if (equalIndex === -1) {
			new Notice("Math block does not contain an equals sign.");
			return;
		}

		const leftPart = mathContent.substring(0, equalIndex + 1).trim();
		const rightPart = mathContent.substring(equalIndex + 1).trim();

		const replacement = `$$${leftPart} $$ [hide]$$${rightPart}$$[/hide]`;

		const startPos = editor.offsetToPos(targetStart);
		const endPos = editor.offsetToPos(targetEnd);

		editor.replaceRange(replacement, startPos, endPos);

		new Notice("Math block split on equals sign.");
	}

	public refreshUnifiedQueue(): void {
		const leaves =
			this.plugin.app.workspace.getLeavesOfType(UNIFIED_VIEW_TYPE);
		leaves.forEach((leaf) => {
			if (leaf.view instanceof SvelteReviewQueueSidebarView) {
				leaf.view.refreshData();
			}
		});
	}
}

export {
	SvelteFlashcardModal,
	createFlashcardModal,
} from "./FlashcardModalView";

export const BATCH_SIZE = 10;
export const LEARNING_STEPS = [1, 10, 60, 1440, 10080];

export function shuffleArray<T>(array: T[]): T[] {
	const newArray = [...array];
	for (let i = newArray.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[newArray[i], newArray[j]] = [newArray[j], newArray[i]];
	}
	return newArray;
}

export function addMinutes(date: Date, minutes: number): Date {
	return new Date(date.getTime() + minutes * 60000);
}

export function formatReviewDate(date: Date, now: Date): string {
	const diff = date.getTime() - now.getTime();
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) {
		return `${days}d`;
	} else if (hours > 0) {
		return `${hours}h`;
	} else if (minutes > 0) {
		return `${minutes}m`;
	} else {
		return "now";
	}
}

export function findCardStateAndFile(
	plugin: SampleNotePlugin,
	cardUUID: string
): { filePath: string; card: CardState } | null {
	for (const filePath in plugin.notes) {
		const card = plugin.notes[filePath].cards[cardUUID];
		if (card) {
			return { filePath, card };
		}
	}
	return null;
}

export function updateCardState(
	card: CardState,
	rating: number,
	now: Date,
	stopScheduling: boolean = false
): CardState {
	const updatedCard = { ...card };

	if (stopScheduling) {
		updatedCard.active = false;
		updatedCard.isLearning = false;
		updatedCard.learningStep = undefined;
		updatedCard.nextReviewDate = new Date().toISOString();
		return updatedCard;
	}

	if (!updatedCard.isLearning) {
		updatedCard.isLearning = true;
		updatedCard.learningStep = 0;
		updatedCard.nextReviewDate = addMinutes(
			now,
			LEARNING_STEPS[0]
		).toISOString();
	} else if (updatedCard.learningStep !== undefined) {
		if (rating >= 3) {
			updatedCard.learningStep++;
			if (updatedCard.learningStep >= LEARNING_STEPS.length) {
				updatedCard.isLearning = false;
				updatedCard.learningStep = undefined;
				updatedCard.repetition = 1;
				updatedCard.interval = 1;
				updatedCard.nextReviewDate = addMinutes(
					now,
					LEARNING_STEPS[LEARNING_STEPS.length - 1]
				).toISOString();
			} else {
				updatedCard.nextReviewDate = addMinutes(
					now,
					LEARNING_STEPS[updatedCard.learningStep]
				).toISOString();
			}
		} else {
			updatedCard.learningStep = 0;
			updatedCard.nextReviewDate = addMinutes(
				now,
				LEARNING_STEPS[0]
			).toISOString();
		}
	} else {
		if (rating >= 3) {
			updatedCard.repetition++;
			updatedCard.interval = Math.round(
				updatedCard.interval * updatedCard.ef
			);
			updatedCard.nextReviewDate = addMinutes(
				now,
				updatedCard.interval * 1440
			).toISOString();
		} else {
			updatedCard.repetition = 0;
			updatedCard.interval = 1;
			updatedCard.nextReviewDate = addMinutes(now, 1440).toISOString();
		}
	}

	const newEF =
		updatedCard.ef + (0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02));
	updatedCard.ef = Math.max(1.3, newEF);

	updatedCard.lastReviewDate = now.toISOString();
	updatedCard.efHistory = [
		...(updatedCard.efHistory || []),
		{
			timestamp: now.toISOString(),
			ef: updatedCard.ef,
			rating: rating,
		},
	];

	return updatedCard;
}

// Store click handlers to ensure proper cleanup
const clickHandlerMap = new WeakMap<HTMLElement, (ev: MouseEvent) => void>();

export function processCustomHiddenText(
	rootEl: HTMLElement,
	hidden: boolean = true,
	hideGroupId?: string
): void {
	// Helper to create a hidden span element
	const createHiddenSpan = (groupId?: string): HTMLElement => {
		const span = document.createElement("span");
		span.classList.add("sample-note-hidable-element");

		if (groupId) {
			span.classList.add("group-hide");
			span.dataset.group = groupId;
			const shouldHide = hideGroupId ? groupId === hideGroupId : hidden;
			if (shouldHide) span.classList.add("sample-note-is-hidden");
		} else {
			const shouldHide = hideGroupId ? false : hidden;
			if (shouldHide) span.classList.add("sample-note-is-hidden");
		}

		return span;
	};

	// Process all text nodes and replace hide tags
	const processTextNodes = (parent: Node): void => {
		// Get all text nodes
		const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) => {
				// Skip text nodes inside already processed hidden elements
				if (
					(node.parentElement as HTMLElement)?.closest(
						".sample-note-hidable-element"
					)
				) {
					return NodeFilter.FILTER_REJECT;
				}
				return node.nodeValue && node.nodeValue.includes("[hide")
					? NodeFilter.FILTER_ACCEPT
					: NodeFilter.FILTER_REJECT;
			},
		});

		const textNodes: Text[] = [];
		let node;
		while ((node = walker.nextNode())) {
			textNodes.push(node as Text);
		}

		// Process each text node
		textNodes.forEach((textNode) => {
			const text = textNode.nodeValue || "";
			const parent = textNode.parentNode;
			if (!parent) return;

			// Parse the text and build a fragment
			const fragment = document.createDocumentFragment();
			let lastIndex = 0;

			// Find all complete hide blocks
			const regex = /\[hide(?:=(\d+))?\]([\s\S]*?)\[\/hide\]/g;
			let match;

			while ((match = regex.exec(text)) !== null) {
				// Add text before the match
				if (match.index > lastIndex) {
					fragment.appendChild(
						document.createTextNode(
							text.substring(lastIndex, match.index)
						)
					);
				}

				// Create hidden span with the content
				const span = createHiddenSpan(match[1]);
				span.textContent = match[2];
				fragment.appendChild(span);

				lastIndex = match.index + match[0].length;
			}

			// Add remaining text
			if (lastIndex < text.length) {
				fragment.appendChild(
					document.createTextNode(text.substring(lastIndex))
				);
			}

			// Only replace if we found matches
			if (lastIndex > 0) {
				parent.replaceChild(fragment, textNode);
			}
		});
	};

	// Handle cases where hide tags span across multiple nodes
	const processComplexHideTags = (container: Node): void => {
		let inHideBlock = false;
		let currentHideSpan: HTMLElement | null = null;
		let hideStartText = "";

		const processNode = (node: Node): Node | null => {
			if (node.nodeType === Node.TEXT_NODE) {
				const text = node.nodeValue || "";
				let newText = text;
				let modified = false;

				// Check for incomplete hide start tag
				if (!inHideBlock && text.includes("[hide")) {
					const startMatch = text.match(/\[hide(?:=(\d+))?\]$/);
					if (startMatch) {
						// Hide tag at the end, content continues in next node
						const beforeTag = text.substring(
							0,
							text.length - startMatch[0].length
						);
						if (beforeTag) {
							const textNode = document.createTextNode(beforeTag);
							node.parentNode?.insertBefore(textNode, node);
						}

						currentHideSpan = createHiddenSpan(startMatch[1]);
						node.parentNode?.insertBefore(currentHideSpan, node);
						inHideBlock = true;

						// Remove the processed node
						const nextNode = node.nextSibling;
						node.parentNode?.removeChild(node);
						return nextNode;
					}
				}

				// Check for hide end tag
				if (inHideBlock && text.includes("[/hide]")) {
					const endIndex = text.indexOf("[/hide]");
					const beforeEnd = text.substring(0, endIndex);
					const afterEnd = text.substring(endIndex + 7);

					if (beforeEnd && currentHideSpan) {
						currentHideSpan.appendChild(
							document.createTextNode(beforeEnd)
						);
					}

					inHideBlock = false;
					currentHideSpan = null;

					if (afterEnd) {
						const afterNode = document.createTextNode(afterEnd);
						node.parentNode?.insertBefore(
							afterNode,
							node.nextSibling
						);
					}

					// Remove the processed node
					const nextNode = node.nextSibling;
					node.parentNode?.removeChild(node);
					return afterEnd ? nextNode : nextNode;
				}

				// If we're in a hide block, move the entire text node into the span
				if (inHideBlock && currentHideSpan) {
					currentHideSpan.appendChild(node.cloneNode(true));
					const nextNode = node.nextSibling;
					node.parentNode?.removeChild(node);
					return nextNode;
				}
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				// If we're in a hide block, move the entire element into the span
				if (inHideBlock && currentHideSpan) {
					currentHideSpan.appendChild(node.cloneNode(true));
					const nextNode = node.nextSibling;
					node.parentNode?.removeChild(node);
					return nextNode;
				}
			}

			return node.nextSibling;
		};

		// Process all child nodes
		let child = container.firstChild;
		while (child) {
			child = processNode(child) as ChildNode | null;
		}
	};

	// First pass: process simple hide tags within single text nodes
	processTextNodes(rootEl);

	// Second pass: handle complex cases where tags span multiple nodes
	// Find containers that might have split hide tags
	const containersToCheck: Element[] = [rootEl];
	const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT, {
		acceptNode: (node) => {
			const element = node as Element;
			if (element.classList.contains("sample-note-hidable-element")) {
				return NodeFilter.FILTER_REJECT;
			}
			// Check if any child text nodes contain partial hide tags
			const hasPartialTags = Array.from(element.childNodes).some(
				(child) => {
					if (child.nodeType === Node.TEXT_NODE) {
						const text = child.nodeValue || "";
						return (
							text.includes("[hide") && !text.includes("[/hide]")
						);
					}
					return false;
				}
			);
			return hasPartialTags
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP;
		},
	});

	let element;
	while ((element = walker.nextNode())) {
		containersToCheck.push(element as Element);
	}

	// Process containers from deepest to shallowest
	containersToCheck.reverse().forEach((container) => {
		processComplexHideTags(container);
	});

	// Add click handler using event delegation
	const clickHandler = (ev: MouseEvent) => {
		const target = ev.target as HTMLElement;
		const hidableElement = target.closest(
			".sample-note-hidable-element"
		) as HTMLElement;

		if (!hidableElement || !rootEl.contains(hidableElement)) return;

		ev.stopPropagation();

		const group = hidableElement.dataset.group;
		if (!group) {
			hidableElement.classList.toggle("sample-note-is-hidden");
		} else {
			const groupElements = rootEl.querySelectorAll<HTMLElement>(
				`.sample-note-hidable-element[data-group="${group}"]`
			);
			const isHidden = hidableElement.classList.contains(
				"sample-note-is-hidden"
			);
			groupElements.forEach((elem) => {
				if (isHidden) {
					elem.classList.remove("sample-note-is-hidden");
				} else {
					elem.classList.add("sample-note-is-hidden");
				}
			});
		}
	};

	// Remove existing listener if present
	const existingHandler = clickHandlerMap.get(rootEl);
	if (existingHandler) {
		rootEl.removeEventListener("click", existingHandler);
	}

	// Add new listener and store reference
	rootEl.addEventListener("click", clickHandler);
	clickHandlerMap.set(rootEl, clickHandler);
}

export function processMathBlocks(rootEl: HTMLElement): void {
	rootEl.querySelectorAll("p").forEach((paragraph) => {
		const mathBlocks = Array.from(
			paragraph.querySelectorAll(".math-block")
		);
		if (mathBlocks.length > 1) {
			const wrapper = document.createElement("div");
			wrapper.classList.add("inline-math-container");
			while (paragraph.firstChild) {
				wrapper.appendChild(paragraph.firstChild);
			}
			paragraph.replaceWith(wrapper);
		}
	});
}
