<script lang="ts">
	import { onMount, createEventDispatcher } from "svelte";
	import type MyPlugin from "../../main";
	import type { Flashcard } from "../../types";
	import CardRenderer from "./CardRenderer.svelte";

	export let plugin: MyPlugin;
	export let flashcard: Flashcard;

	const dispatch = createEventDispatcher<{
		skip: void;
		close: void;
	}>();

	let cardContainer: HTMLElement;
	let contentWrapper: HTMLElement;

	function skipCard() {
		dispatch("skip");
	}

	onMount(() => {
		if (cardContainer) {
			contentWrapper = cardContainer.appendChild(
				document.createElement("div"),
			);
			contentWrapper.setAttribute("data-flashcard-content", "true");
			contentWrapper.classList.add("flashcard-content-wrapper");
		}
	});
</script>

<div bind:this={cardContainer} class="flashcard-container">
	{#if contentWrapper}
		<CardRenderer
			{plugin}
			{flashcard}
			{contentWrapper}
			on:skip={skipCard}
			on:close={() => dispatch("close")}
		/>
	{/if}
</div>

<style>
	.flashcard-container {
		width: 100%;
		height: 100%;
	}

	:global(.flashcard-content-wrapper) {
		width: 100%;
		animation: fadeIn 0.2s ease-in-out;
	}

	:global(.flashcard-content-wrapper > div) {
		animation: fadeIn 0.15s ease-in-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
