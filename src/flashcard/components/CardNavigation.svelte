<script lang="ts">
	import { createEventDispatcher } from "svelte";

	export let currentIndex: number;
	export let totalCardCount: number;

	const dispatch = createEventDispatcher<{
		navigate_to_card: void;
	}>();

	function handleNavigateToCard() {
		dispatch("navigate_to_card");
	}
</script>

<div
	class="navigation-button"
	on:click={handleNavigateToCard}
	on:keydown={(e) =>
		e.key === "Enter" || e.key === " " ? handleNavigateToCard() : null}
	role="button"
	tabindex="0"
>
	{currentIndex + 1} / {totalCardCount}
</div>

<style lang="postcss">
	.navigation-button {
		@apply block w-full px-2 py-1 mt-2 text-sm text-center text-gray-700 transition-colors duration-200 rounded cursor-pointer dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800;
	}
</style>
