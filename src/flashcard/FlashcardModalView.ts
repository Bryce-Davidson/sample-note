import { Modal, App, TFile } from "obsidian";
import FlashcardModal from "./FlashcardModal.svelte";
import type SampleNotePlugin from "../main";

import { CardState, Flashcard, CardMetadata } from "src/types";

export class SvelteFlashcardModal extends Modal {
	private component: FlashcardModal | null = null;
	private plugin: SampleNotePlugin;
	private flashcards: Flashcard[];
	private showNoteTitle: boolean;
	private allCardMetadata: CardMetadata[];
	private sidebarView: any | null;
	private isPaginated: boolean;
	private onCardReviewed:
		| ((cardUUID: string, cardState: CardState) => void)
		| null;

	constructor(
		app: App,
		flashcards: Flashcard[],
		plugin: SampleNotePlugin,
		showNoteTitle: boolean = false,
		allCardMetadata: CardMetadata[] = [],
		sidebarView: any | null = null,
		isPaginated: boolean = false,
		onCardReviewed:
			| ((cardUUID: string, cardState: CardState) => void)
			| null = null
	) {
		super(app);
		this.plugin = plugin;
		this.flashcards = flashcards;
		this.showNoteTitle = showNoteTitle;
		this.allCardMetadata = allCardMetadata;
		this.sidebarView = sidebarView;
		this.isPaginated = isPaginated;
		this.onCardReviewed = onCardReviewed;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		contentEl.empty();

		modalEl.addClass("sample-note-flashcard-modal");
		contentEl.addClass("sample-note-flashcard-modal-content");

		this.component = new FlashcardModal({
			target: contentEl,
			props: {
				plugin: this.plugin,
				flashcards: this.flashcards,
				allCardMetadata: this.allCardMetadata,
				sidebarView: this.sidebarView,
				isPaginated: this.isPaginated,
			},
		});

		this.setupComponentEventListeners();

		setTimeout(() => {
			if (document.activeElement instanceof HTMLElement) {
				document.activeElement.blur();
			}
		}, 0);
	}

	private setupComponentEventListeners(): void {
		if (!this.component) return;

		this.component.$on("close", () => {
			this.close();
		});

		this.component.$on("card_reviewed", (event) => {
			const { cardUUID, cardState } = event.detail;
			if (this.onCardReviewed) {
				this.onCardReviewed(cardUUID, cardState);
			}
		});

		this.component.$on("navigate_to_card", (event) => {
			const { filePath, line } = event.detail;
			const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
			if (file && file instanceof TFile) {
				const options = {
					eState: { line: line - 1, ch: 0 },
				};
				this.plugin.app.workspace.getLeaf().openFile(file, options);
				this.close();
			}
		});
	}

	onClose() {
		if (this.component) {
			try {
				this.component.$destroy();
			} catch (e) {
				console.error("Error destroying flashcard component:", e);
			}
			this.component = null;
		}
		this.contentEl.empty();
	}
}

export function createFlashcardModal(
	app: App,
	flashcards: Flashcard[],
	plugin: SampleNotePlugin,
	showNoteTitle: boolean = false,
	allCardMetadata: CardMetadata[] = [],
	sidebarView: any | null = null,
	onCardReviewed:
		| ((cardUUID: string, cardState: CardState) => void)
		| null = null
): SvelteFlashcardModal {
	const isPaginated = allCardMetadata.length > 0 && sidebarView !== null;

	return new SvelteFlashcardModal(
		app,
		flashcards,
		plugin,
		showNoteTitle,
		allCardMetadata,
		sidebarView,
		isPaginated,
		onCardReviewed
	);
}
