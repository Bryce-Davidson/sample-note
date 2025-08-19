<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { createEventDispatcher } from "svelte";
	import { Notice } from "obsidian";
	import type SampleNotePlugin from "../main";
	import type { Flashcard, CardMetadata, CardState } from "../types";
	import {
		findCardStateAndFile,
		updateCardState,
		BATCH_SIZE,
	} from "./FlashcardManager";

	import ProgressBar from "./components/ProgressBar.svelte";

	import CardNavigation from "./components/CardNavigation.svelte";
	import CardContent from "./components/CardContent.svelte";
	import RatingButtons from "./components/RatingButtons.svelte";

	import { flashcardEventStore } from "./FlashcardEventStore";

	export let plugin: SampleNotePlugin;
	export let flashcards: Flashcard[] = [];
	export let allCardMetadata: CardMetadata[] = [];
	export let sidebarView: any | null = null;
	export let isPaginated: boolean = false;

	const dispatch = createEventDispatcher<{
		close: void;
		card_reviewed: { cardUUID: string; cardState: CardState };
		navigate_to_card: { filePath: string; line: number };
	}>();

	let currentIndex: number = 0;
	let isLoadingMore: boolean = false;
	let preloadThreshold: number = 3;
	let totalCardCount: number = isPaginated
		? allCardMetadata.length
		: flashcards.length;

	let modalContainer: HTMLElement;

	// Simple async operation tracking for cleanup
	let pendingOperations: Promise<void>[] = [];

	function showTopNotice(message: string, timeout: number = 4000): Notice {
		const notice = new Notice(message, timeout);
		const noticeElements = document.querySelectorAll(".notice");
		if (noticeElements.length > 0) {
			const latestNotice = noticeElements[
				noticeElements.length - 1
			] as HTMLElement;
			if (latestNotice) {
				latestNotice.addClass("sample-note-top-notice");
			}
		}
		return notice;
	}

	// Simple fire-and-forget async operation
	function queueAsyncOperation(cardUUID: string, cardState: CardState) {
		const operation = (async () => {
			try {
				await plugin.savePluginData();
				plugin.flashcardManager.refreshUnifiedQueue();
				flashcardEventStore.dispatchCardReviewed(cardUUID, cardState);
			} catch (error) {
				console.error("Error saving card data:", error);
				showTopNotice("Error saving progress, but review continues.");
			}
		})();

		// Track for cleanup, but don't wait
		pendingOperations.push(operation);

		// Clean up completed operations periodically to prevent memory leaks
		if (pendingOperations.length > 10) {
			pendingOperations = pendingOperations.slice(-5); // Keep only the last 5 operations
		}
	}

	async function handleRating(rating: number) {
		const now = new Date();
		const currentCard = flashcards[currentIndex];
		const found = findCardStateAndFile(plugin, currentCard.uuid);

		if (!found) {
			showTopNotice("Card state not found.");
			return;
		}

		const { filePath, card } = found;
		const updated = updateCardState(card, rating, now, false);
		plugin.notes[filePath].cards[card.cardUUID] = updated;

		// Move to next card immediately for fast transition
		moveToNextCardOrClose();

		// Queue async operations (fire-and-forget)
		queueAsyncOperation(card.cardUUID, updated);
	}

	async function handleStop() {
		const currentFlashcard = flashcards[currentIndex];
		const found = findCardStateAndFile(plugin, currentFlashcard.uuid);

		if (!found) {
			showTopNotice("Card state not found.");
			return;
		}

		const { filePath, card } = found;
		const now = new Date();
		const updated = updateCardState(card, 0, now, true);
		plugin.notes[filePath].cards[card.cardUUID] = updated;

		showTopNotice("Scheduling stopped for this card.");

		// Move to next card immediately for fast transition
		moveToNextCardOrClose();

		// Queue async operations (fire-and-forget)
		queueAsyncOperation(card.cardUUID, updated);
	}

	function navigateToCard() {
		const currentFlashcard = flashcards[currentIndex];
		if (currentFlashcard.filePath && currentFlashcard.line) {
			dispatch("navigate_to_card", {
				filePath: currentFlashcard.filePath,
				line: currentFlashcard.line,
			});
		} else {
			showTopNotice(
				"No location information available for this flashcard.",
			);
		}
	}

	function skipCard() {
		moveToNextCardOrClose();
	}

	function moveToNextCardOrClose() {
		if (currentIndex < flashcards.length - 1) {
			currentIndex++;
			if (isPaginated && shouldPreloadMoreCards()) {
				preloadNextBatch();
			}
		} else {
			dispatch("close");
		}
	}

	function shouldPreloadMoreCards(): boolean {
		return (
			flashcards.length < totalCardCount &&
			currentIndex >= flashcards.length - preloadThreshold
		);
	}

	async function preloadNextBatch() {
		if (isLoadingMore || !sidebarView) return;
		isLoadingMore = true;

		try {
			const startIndex = flashcards.length;
			const endIndex = Math.min(startIndex + BATCH_SIZE, totalCardCount);

			if (startIndex >= totalCardCount) {
				isLoadingMore = false;
				return;
			}

			const nextBatch = await sidebarView.loadCardBatch(
				allCardMetadata.slice(startIndex, endIndex),
			);
			flashcards = [...flashcards, ...nextBatch];
		} catch (error) {
			console.error("Error preloading more cards:", error);
		} finally {
			isLoadingMore = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key >= "1" && event.key <= "5") {
			const rating = parseInt(event.key);
			handleRating(rating);
		} else if (event.key === "Escape") {
			dispatch("close");
		}
	}

	$: currentFlashcard = flashcards[currentIndex];

	onMount(() => {
		document.addEventListener("keydown", handleKeydown);

		setTimeout(() => {
			if (document.activeElement instanceof HTMLElement) {
				document.activeElement.blur();
			}
		}, 0);
	});

	onDestroy(() => {
		document.removeEventListener("keydown", handleKeydown);

		// Wait for any pending async operations to complete
		if (pendingOperations.length > 0) {
			Promise.allSettled(pendingOperations).catch((error) =>
				console.error("Error waiting for pending operations:", error),
			);
		}
	});
</script>

<div class="modal-inner" bind:this={modalContainer}>
	<div class="top-bar">
		<ProgressBar {currentIndex} {totalCardCount} />
		<CardNavigation
			{currentIndex}
			{totalCardCount}
			on:navigate_to_card={navigateToCard}
		/>
	</div>

	<div class="content">
		{#if currentFlashcard}
			<CardContent
				{plugin}
				flashcard={currentFlashcard}
				on:skip={skipCard}
				on:close={() => dispatch("close")}
			/>
		{:else}
			<div class="no-cards">No flashcards available.</div>
		{/if}
	</div>

	<div class="bottom-tray">
		<RatingButtons
			on:rating={(e) => handleRating(e.detail.rating)}
			on:stop={handleStop}
		/>
	</div>
</div>

<style lang="postcss">
	.modal-inner {
		@apply flex flex-col h-full w-full;
		box-sizing: border-box;
	}

	.top-bar {
		@apply w-full flex flex-col items-center justify-center mb-4 flex-shrink-0;
	}

	.content {
		@apply flex-1 min-h-0 overflow-y-auto w-full;
	}

	.no-cards {
		@apply text-gray-500 text-center p-8;
	}

	.bottom-tray {
		@apply w-full pt-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0;
	}
</style>
