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
		await plugin.savePluginData();
		plugin.flashcardManager.refreshUnifiedQueue();

		flashcardEventStore.dispatchCardReviewed(card.cardUUID, updated);

		moveToNextCardOrClose();
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
		await plugin.savePluginData();
		showTopNotice("Scheduling stopped for this card.");
		plugin.flashcardManager.refreshUnifiedQueue();

		flashcardEventStore.dispatchCardReviewed(card.cardUUID, updated);

		moveToNextCardOrClose();
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
	});
</script>

<div class="modal-container" bind:this={modalContainer}>
	<div class="top-bar">
		<ProgressBar {currentIndex} {totalCardCount} />
		<CardNavigation
			{currentIndex}
			{totalCardCount}
			on:navigate_to_card={navigateToCard}
		/>
	</div>

	<div class="main-content">
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
	.modal-container {
		@apply flex flex-col h-full w-full;
		/* Add padding with consideration for scrollbars */
		padding: 1rem 0.75rem;
		box-sizing: border-box;
	}

	.top-bar {
		@apply w-full flex flex-col items-center justify-center mb-4 flex-shrink-0;
	}

	.main-content {
		@apply flex-1 min-h-0 overflow-y-auto w-full;
		/* Add padding to prevent content from hiding behind scrollbars */
		padding: 0.5rem 1rem;
		/* Ensure content doesn't touch scrollbar */
		box-sizing: border-box;
	}

	.no-cards {
		@apply text-gray-500 text-center p-8;
	}

	.bottom-tray {
		@apply w-full pt-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0;
		/* Remove horizontal padding as it's handled by modal-container */
	}

	/* Mobile adjustments - align with main.css breakpoint */
	@media (max-width: 480px) {
		.modal-container {
			padding: 0.75rem 0.5rem;
		}

		.main-content {
			padding: 0.25rem 0.75rem;
		}

		.top-bar {
			margin-bottom: 0.5rem;
		}

		.bottom-tray {
			padding-top: 0.5rem;
		}
	}
</style>
