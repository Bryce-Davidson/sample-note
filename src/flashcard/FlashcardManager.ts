import { TFile, Notice, Editor, MarkdownRenderer } from "obsidian";
import MyPlugin, { nanoid } from "../main";
import type { CardState, Flashcard, CardMetadata } from "../types";
import { createFlashcardModal } from "./FlashcardModalView";
import {
	SvelteReviewQueueSidebarView,
	UNIFIED_VIEW_TYPE,
} from "../review/ReviewQueueSidebarView";

export class FlashcardManager {
	private plugin: MyPlugin;

	constructor(plugin: MyPlugin) {
		this.plugin = plugin;
		this.registerEvents();
		this.registerMarkdownPostProcessor();
	}

	private registerMarkdownPostProcessor(): void {
		this.plugin.registerMarkdownPostProcessor((el: HTMLElement) => {
			el.innerHTML = el.innerHTML.replace(/\[\/?card(?:=[^\]]+)?\]/g, "");
		});
	}

	private registerEvents(): void {
		this.plugin.registerEvent(
			this.plugin.app.workspace.on("file-open", async (file: TFile) => {
				if (file && file instanceof TFile) {
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
			new Notice("No flashcards found.");
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
			new Notice(`Error preparing flashcards: ${error.message}`);
			console.error("Error in showAllDueFlashcardsModal:", error);
		}
	}

	async syncFlashcardsForFile(file: TFile): Promise<Flashcard[]> {
		try {
			let content = await this.plugin.app.vault.read(file);
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
			new Notice("Error syncing flashcards. Check console for details.");
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
	plugin: MyPlugin,
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

export function processCustomHiddenText(
	rootEl: HTMLElement,
	hidden: boolean = true,
	hideGroupId?: string
): void {
	const elements = rootEl.querySelectorAll("*");
	elements.forEach((element) => {
		let html = element.innerHTML;
		if (html.includes("[hide") && html.includes("[/hide]")) {
			html = html.replace(
				/\[hide=(\d+)\]([\s\S]*?)\[\/hide\]/g,
				(match, groupId, content) => {
					const shouldHide = hideGroupId
						? groupId === hideGroupId
						: hidden;
					const hiddenClass = shouldHide
						? "sample-note-is-hidden"
						: "";
					return `<span class="sample-note-hidable-element group-hide ${hiddenClass}" data-group="${groupId}">${content}</span>`;
				}
			);

			html = html.replace(
				/\[hide\]([\s\S]*?)\[\/hide\]/g,
				(match, content) => {
					const shouldHide = hideGroupId ? false : hidden;
					const hiddenClass = shouldHide
						? "sample-note-is-hidden"
						: "";
					return `<span class="sample-note-hidable-element ${hiddenClass}">${content}</span>`;
				}
			);

			element.innerHTML = html;
			element.querySelectorAll(".group-hide").forEach((el) => {
				el.addEventListener("click", function () {
					const group = this.getAttribute("data-group");
					if (!group) {
						this.classList.toggle("sample-note-is-hidden");
					} else {
						const groupElements = document.querySelectorAll(
							`.group-hide[data-group="${group}"]`
						);
						const isHidden =
							groupElements.length > 0 &&
							groupElements[0].classList.contains(
								"sample-note-is-hidden"
							);
						groupElements.forEach((elem: HTMLElement) => {
							if (isHidden) {
								elem.classList.remove("sample-note-is-hidden");
							} else {
								elem.classList.add("sample-note-is-hidden");
							}
						});
					}
				});
			});
			element
				.querySelectorAll(
					".sample-note-hidable-element:not(.group-hide)"
				)
				.forEach((el) => {
					el.addEventListener("click", function () {
						this.classList.toggle("sample-note-is-hidden");
					});
				});
		}
	});
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
