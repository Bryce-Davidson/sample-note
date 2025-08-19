<script lang="ts">
	export let uniqueTagsSet: Set<string>;
	export let onDeckClick: (tag: string) => void;

	// Convert set to array and add "all" option at the beginning
	$: decks = ["all", ...Array.from(uniqueTagsSet)];

	function getDeckIcon(tag: string) {
		// You can customize icons based on tag names
		if (tag === "all") return "📚";
		// Default icon for other tags
		return "📖";
	}

	function getDeckLabel(tag: string) {
		if (tag === "all") return "All Cards";
		return tag;
	}
</script>

<div class="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 lg:grid-cols-4">
	{#each decks as deck}
		<button
			class="flex flex-col justify-center items-center p-6 text-center bg-white rounded-lg border border-gray-200 shadow-md transition-all hover:shadow-lg hover:scale-105 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-700"
			on:click={() => onDeckClick(deck)}
		>
			<div class="mb-2 text-3xl">
				{getDeckIcon(deck)}
			</div>
			<div class="text-sm font-medium text-gray-800 dark:text-gray-200">
				{getDeckLabel(deck)}
			</div>
		</button>
	{/each}
</div>

{#if decks.length === 1}
	<!-- Only "all" deck exists, no tags found -->
	<div class="flex flex-col justify-center items-center p-10 text-center">
		<p class="text-gray-600 dark:text-gray-400">
			No tags found. Add tags to your flashcards to create decks.
		</p>
	</div>
{/if}
