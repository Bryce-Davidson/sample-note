<script lang="ts">
	import { createEventDispatcher } from "svelte";

	const dispatch = createEventDispatcher<{
		rating: { rating: number };
		stop: void;
	}>();

	function handleRating(rating: number) {
		dispatch("rating", { rating });
	}

	function handleStop() {
		dispatch("stop");
	}
</script>

<div class="rating-container sample-note-reset">
	<div class="stop-button-container">
		<button class="stop-button" on:click={handleStop}> Stop </button>
	</div>

	<!-- Rating Tray -->
	<div class="rating-tray">
		{#each [{ value: 1, color: "#FF4C4C" }, { value: 2, color: "#FFA500" }, { value: 3, color: "#FFFF66" }, { value: 4, color: "#ADFF2F" }, { value: 5, color: "#7CFC00" }] as rating}
			<button
				class="rating-button"
				style="background-color: {rating.color}"
				on:click={() => handleRating(rating.value)}
				title="Rate {rating.value}"
			>
			</button>
		{/each}
	</div>
</div>

<style lang="postcss">
	.rating-container {
		@apply flex items-center justify-between w-full gap-4;
	}

	.stop-button-container {
		@apply flex items-center flex-none gap-4;
	}

	.stop-button {
		@apply px-3 py-2 text-sm text-white transition-opacity duration-200 bg-red-500 border-none rounded cursor-pointer hover:opacity-90;
	}

	.rating-tray {
		@apply flex flex-1 gap-4;
	}

	.rating-button {
		@apply flex-1 py-2.5 px-4 border-none rounded text-sm cursor-pointer transition-all duration-100 ease-in-out flex items-center justify-center hover:scale-105 hover:shadow-md;
	}
</style>
