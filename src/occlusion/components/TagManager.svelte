<script lang="ts">
	import { createEventDispatcher } from "svelte";

	export let tags: string[] = [];
	export let allAvailableTags: Set<string> = new Set();

	const dispatch = createEventDispatcher();

	let newTag = "";
	let showTagInput = false;
	let tagInputElement: HTMLInputElement;
	let showSuggestions = false;
	let selectedSuggestionIndex = -1;

	$: suggestions = newTag.trim()
		? Array.from(allAvailableTags).filter(
				(tag) =>
					tag.toLowerCase().includes(newTag.toLowerCase()) &&
					!tags.includes(tag),
			)
		: [];

	function addTag() {
		const trimmedTag = newTag.trim();
		if (trimmedTag && !tags.includes(trimmedTag)) {
			tags = [...tags, trimmedTag];
			dispatch("change", tags);
			newTag = "";
			showSuggestions = false;
			selectedSuggestionIndex = -1;
		}
	}

	function removeTag(tag: string) {
		tags = tags.filter((t) => t !== tag);
		dispatch("change", tags);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			event.preventDefault();
			if (
				selectedSuggestionIndex >= 0 &&
				selectedSuggestionIndex < suggestions.length
			) {
				selectSuggestion(suggestions[selectedSuggestionIndex]);
			} else {
				addTag();
			}
		} else if (event.key === "Escape") {
			showSuggestions = false;
			selectedSuggestionIndex = -1;
		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			selectedSuggestionIndex = Math.min(
				selectedSuggestionIndex + 1,
				suggestions.length - 1,
			);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
		}
	}

	function selectSuggestion(tag: string) {
		newTag = tag;
		addTag();
	}

	function toggleTagInput() {
		showTagInput = !showTagInput;
		if (showTagInput) {
			setTimeout(() => tagInputElement?.focus(), 10);
		} else {
			newTag = "";
			showSuggestions = false;
		}
	}

	function handleInputFocus() {
		showSuggestions = suggestions.length > 0;
	}

	function handleInputBlur() {
		// Delay to allow click on suggestion
		setTimeout(() => {
			showSuggestions = false;
			selectedSuggestionIndex = -1;
		}, 200);
	}
</script>

<div class="tag-manager">
	<div class="flex items-center gap-2 mb-2">
		<span class="text-sm font-medium text-gray-700 dark:text-gray-300"
			>Tags:</span
		>
		<button
			class="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
			on:click={toggleTagInput}
			title="Add tag"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="w-4 h-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<line x1="12" y1="5" x2="12" y2="19"></line>
				<line x1="5" y1="12" x2="19" y2="12"></line>
			</svg>
		</button>
	</div>

	<div class="flex flex-wrap gap-2">
		{#each tags as tag}
			<span
				class="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full dark:bg-gray-700 dark:text-gray-300"
			>
				#{tag}
				<button
					class="ml-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
					on:click={() => removeTag(tag)}
					title="Remove tag"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="w-3 h-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</span>
		{/each}

		{#if showTagInput}
			<div class="relative">
				<input
					bind:this={tagInputElement}
					bind:value={newTag}
					on:keydown={handleKeydown}
					on:input={() => (showSuggestions = suggestions.length > 0)}
					on:focus={handleInputFocus}
					on:blur={handleInputBlur}
					placeholder="Add tag..."
					class="px-2 py-1 text-xs border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
				/>

				{#if showSuggestions && suggestions.length > 0}
					<div
						class="absolute z-10 w-48 mt-1 bg-white border border-gray-300 rounded-md shadow-lg dark:bg-gray-800 dark:border-gray-600"
					>
						{#each suggestions as suggestion, index}
							<button
								class="block w-full px-3 py-1 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700"
								class:bg-gray-100={index ===
									selectedSuggestionIndex}
								class:dark:bg-gray-700={index ===
									selectedSuggestionIndex}
								on:click={() => selectSuggestion(suggestion)}
							>
								#{suggestion}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
