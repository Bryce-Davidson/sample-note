<script lang="ts">
	import { createEventDispatcher } from "svelte";

	export let errorMessage: string;
	export let filePath: string | undefined;
	export let line: number | undefined;
	export let cardTitle: string | undefined;

	const dispatch = createEventDispatcher<{
		skip: void;
	}>();

	function skipCard() {
		dispatch("skip");
	}
</script>

<div
	class="p-4 text-red-600 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900 dark:text-red-200 dark:border-red-700"
>
	{errorMessage}
</div>
{#if filePath}
	<div class="mt-2 text-sm text-gray-600 dark:text-gray-400">
		File: {filePath} (line {line || "unknown"})
	</div>
{/if}
{#if cardTitle}
	<div class="mt-1 text-sm text-gray-600 dark:text-gray-400">
		Card title: {cardTitle}
	</div>
{/if}

<button
	on:click={skipCard}
	class="px-4 py-2 mt-3 text-white transition-colors bg-gray-500 rounded-lg hover:bg-gray-600"
>
	Skip this card
</button>
