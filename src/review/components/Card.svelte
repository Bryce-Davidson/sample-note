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

	$: contentVersion =
		typeof cardState?.contentVersion === "number"
			? cardState.contentVersion
			: undefined;
	$: lastReviewedVersion =
		typeof cardState?.lastReviewedVersion === "number"
			? cardState.lastReviewedVersion
			: contentVersion;
	$: showUpdatedBadge =
		typeof contentVersion === "number" &&
		(lastReviewedVersion ?? contentVersion) < contentVersion;
</script>

<div
	class="flex relative flex-col p-5 w-full text-left bg-white rounded-lg border border-gray-200 shadow-sm cursor-pointer dark:bg-gray-800 dark:border-gray-700"
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
	<div class="flex justify-between items-center">
		<h3
			class="py-0 my-0 text-lg font-medium text-gray-900 truncate dark:text-gray-100"
			title={displayTitle}
		>
			{displayTitle}
		</h3>
		{#if showUpdatedBadge || cardState.hideGroupId}
			<div class="flex gap-2 items-center">
				{#if showUpdatedBadge}
					<span
						class="inline-flex w-2.5 h-2.5 bg-amber-400 rounded-full dark:bg-amber-300"
						title="Card content changed since your last review"
						role="img"
						aria-label="Card content changed since your last review"
					>
					</span>
				{/if}
				{#if cardState.hideGroupId}
					<span
						class="inline-flex items-center px-1 py-1 text-xs font-medium text-green-700 whitespace-nowrap bg-green-100 rounded-md dark:bg-green-700 dark:text-green-100"
					>
						Group {cardState.hideGroupId}
					</span>
				{/if}
			</div>
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
		class="flex absolute right-3 bottom-3 justify-center items-center p-1.5 w-7 h-7 text-white bg-indigo-600 rounded-lg shadow-none dark:bg-indigo-500"
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
