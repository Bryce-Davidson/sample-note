<script lang="ts">
	import { TFile } from "obsidian";
	import type SampleNotePlugin from "../../main";
	import { createFlashcardModal } from "../../flashcard/FlashcardManager";

	export let plugin: SampleNotePlugin;
	export let cardState: any;
	export let filePath: string;
	export let file: TFile;
	export let cardMeta: {
		reviewDateText: string;
		efText: string;
		efColorClass: string;
	};

	function handleCardNavigation() {
		if (cardState.occlusionData) {
			plugin.occlusionManager.openOcclusionEditorWithFile(file.path);
			return;
		}
		if (cardState.line !== undefined) {
			const options = {
				eState: { line: cardState.line - 1, ch: 0 },
			};
			plugin.app.workspace.getLeaf().openFile(file, options);
		} else {
			plugin.app.workspace.getLeaf().openFile(file);
		}
	}

	const displayTitle =
		cardState.cardTitle || (file instanceof TFile ? file.basename : "");
</script>

<div
	class="relative flex flex-col w-full p-5 text-left bg-white border border-gray-200 rounded-lg shadow-sm cursor-pointer dark:bg-gray-800 dark:border-gray-700"
	role="button"
	tabindex="0"
	on:click={handleCardNavigation}
	on:keydown={(event) => {
		if (event.key === "Enter" || event.key === " ") {
			handleCardNavigation();
			event.preventDefault();
		}
	}}
>
	<div class="flex items-center justify-between">
		<h3
			class="py-0 my-0 text-lg font-medium text-gray-900 truncate dark:text-gray-100"
			title={displayTitle}
		>
			{displayTitle}
		</h3>
		{#if cardState.hideGroupId}
			<span
				class="inline-flex items-center px-1 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-md dark:bg-green-700 dark:text-green-100 whitespace-nowrap"
			>
				Group {cardState.hideGroupId}
			</span>
		{/if}
	</div>

	<div class="pt-3 mt-auto space-y-2 text-sm">
		{#if cardMeta.reviewDateText}
			<div class="text-gray-500 dark:text-gray-400">
				{cardMeta.reviewDateText}
			</div>
		{/if}
		<div class="flex items-center">
			<span class="mr-1 text-gray-500 dark:text-gray-400">EF: </span>
			<span
				class={`py-0.5 px-2 rounded-md font-medium ${cardMeta.efColorClass}`}
			>
				{cardMeta.efText}
			</span>
		</div>
	</div>

	<button
		class="p-1.5 rounded-lg flex items-center justify-center text-white bg-indigo-600 dark:bg-indigo-500 shadow-none absolute w-7 h-7 bottom-3 right-3"
		aria-label="Review flashcard"
		on:click|stopPropagation|preventDefault={() => {
			const flashcard = {
				uuid: cardState.cardUUID,
				content: cardState.cardContent,
				noteTitle: file.basename,
				filePath: filePath,
				cardTitle: cardState.cardTitle,
				line: cardState.line,
				nextReviewDate: cardState.nextReviewDate,
				ef: cardState.ef,
			};
			createFlashcardModal(plugin.app, [flashcard], plugin, true).open();
		}}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="w-3.5 h-3.5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
			<circle cx="12" cy="12" r="3"></circle>
		</svg>
	</button>
</div>
