<script lang="ts">
	export let uniqueTagsSet: Set<string>;
	export let onDeckClick: (tag: string) => void;
	export let getCardCountForTag: (tag: string) => number;
	export let deckUsage: Record<string, string>;

	// Convert set to array, add "all" option, and sort by last review time
	$: decks = (() => {
		const tagDecks = Array.from(uniqueTagsSet);

		// Sort only the tag decks by last review time (most recent first)
		const sortedTagDecks = tagDecks.sort((a, b) => {
			const timeA = deckUsage[a] || "";
			const timeB = deckUsage[b] || "";

			// If neither has been reviewed, keep alphabetical order
			if (!timeA && !timeB) {
				return a.localeCompare(b);
			}

			// If only one has been reviewed, put reviewed one first
			if (!timeA) return 1;
			if (!timeB) return -1;

			// Both have been reviewed, sort by most recent first
			return new Date(timeB).getTime() - new Date(timeA).getTime();
		});

		// Always put "all" first, followed by sorted tag decks
		return ["all", ...sortedTagDecks];
	})();

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

	function getCardCount(tag: string) {
		return getCardCountForTag(tag);
	}

	function getLastReviewText(tag: string): string {
		const lastReview = deckUsage[tag];
		if (!lastReview) return "";

		const reviewDate = new Date(lastReview);
		const now = new Date();
		const diffMs = now.getTime() - reviewDate.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffMinutes = Math.floor(diffMs / (1000 * 60));

		if (diffMinutes < 1) return "Just now";
		if (diffMinutes < 60) return `${diffMinutes}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays === 1) return "1 day ago";
		if (diffDays < 7) return `${diffDays} days ago`;
		return reviewDate.toLocaleDateString();
	}
</script>

<div
	class="grid gap-4 p-4 deck-grid"
	style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))"
>
	{#each decks as deck}
		<button
			class="flex flex-col justify-center items-center p-6 text-center bg-white rounded-lg border border-gray-200 shadow-md dark:bg-gray-800 dark:border-gray-700"
			on:click={() => onDeckClick(deck)}
		>
			<div class="mb-2 text-3xl">
				{getDeckIcon(deck)}
			</div>
			<div class="text-sm font-medium text-gray-800 dark:text-gray-200">
				{getDeckLabel(deck)}
			</div>
			<div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
				{getCardCount(deck)} card{getCardCount(deck) === 1 ? "" : "s"}
			</div>
			{#if getLastReviewText(deck)}
				<div
					class="mt-0.5 text-xs text-indigo-500 dark:text-indigo-400"
				>
					{getLastReviewText(deck)}
				</div>
			{/if}
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

<style>
	@media (max-width: 767px) {
		:global(.deck-grid) {
			grid-template-columns: 1fr 1fr !important;
		}
	}
</style>
