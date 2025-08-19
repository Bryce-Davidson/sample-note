<script lang="ts">
	import { createEventDispatcher, tick } from "svelte";

	export let tags: string[] = [];
	export let allAvailableTags: Set<string> = new Set();

	const dispatch = createEventDispatcher();

	let newTag = "";
	let isAddingTag = false;
	let tagInputElement: HTMLInputElement;
	let showSuggestions = false;
	let selectedSuggestionIndex = -1;
	let inputContainer: HTMLDivElement;

	$: suggestions = newTag.trim()
		? Array.from(allAvailableTags).filter(
				(tag) =>
					tag.toLowerCase().includes(newTag.toLowerCase()) &&
					!tags.includes(tag),
			)
		: [];

	async function addTag() {
		const trimmedTag = newTag.trim();
		if (trimmedTag && !tags.includes(trimmedTag)) {
			// Add tag with smooth transition
			tags = [...tags, trimmedTag];
			dispatch("change", tags);

			// Reset state
			newTag = "";
			showSuggestions = false;
			selectedSuggestionIndex = -1;

			// Wait for DOM update then hide input smoothly
			await tick();
			isAddingTag = false;
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
			cancelAddTag();
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

	async function startAddingTag() {
		isAddingTag = true;
		await tick();
		tagInputElement?.focus();
	}

	function cancelAddTag() {
		newTag = "";
		showSuggestions = false;
		selectedSuggestionIndex = -1;
		isAddingTag = false;
	}

	function handleInputFocus() {
		showSuggestions = suggestions.length > 0;
	}

	function handleInputBlur(event: FocusEvent) {
		// Don't hide if clicking on a suggestion
		const relatedTarget = event.relatedTarget as HTMLElement;
		if (relatedTarget?.closest(".suggestions-dropdown")) {
			return;
		}

		// Delay to allow for suggestion clicks
		setTimeout(() => {
			if (!inputContainer?.contains(document.activeElement)) {
				cancelAddTag();
			}
		}, 150);
	}

	function handleSuggestionMouseDown(event: MouseEvent) {
		// Prevent input blur when clicking suggestions
		event.preventDefault();
	}
</script>

<div class="tag-manager">
	<!-- Tags display with inline add functionality -->
	<div class="flex flex-wrap gap-2 items-center">
		<span
			class="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0"
		>
			Tags:
		</span>

		<!-- Existing tags -->
		{#each tags as tag}
			<span
				class="inline-flex gap-1 items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-full border border-blue-200 tag-pill dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700"
			>
				<span class="text-blue-500 dark:text-blue-400">#</span>{tag}
				<button
					class="p-0.5 ml-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
					on:click={() => removeTag(tag)}
					title="Remove tag"
				>
					×
				</button>
			</span>
		{/each}

		<!-- Add tag section -->
		<div
			class="inline-flex relative items-center"
			bind:this={inputContainer}
		>
			{#if !isAddingTag}
				<!-- Add tag button - looks like a tag pill -->
				<button
					class="inline-flex gap-1 items-center px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 rounded-full border border-gray-200 border-dashed add-tag-btn focus:outline-none dark:bg-gray-800/50 dark:border-gray-600 dark:text-gray-400"
					on:click={startAddingTag}
					title="Add tag"
				>
					+ Add tag
				</button>
			{:else}
				<!-- Input field that appears seamlessly -->
				<div class="relative tag-input-container">
					<input
						bind:this={tagInputElement}
						bind:value={newTag}
						on:keydown={handleKeydown}
						on:input={() =>
							(showSuggestions = suggestions.length > 0)}
						on:focus={handleInputFocus}
						on:blur={handleInputBlur}
						placeholder="Enter tag name..."
						class="px-3 py-1.5 text-xs font-medium bg-white rounded-full border border-blue-300 tag-input min-w-32 focus:outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-blue-600 dark:text-white dark:focus:border-blue-500"
						autocomplete="off"
					/>

					<!-- Suggestions dropdown -->
					{#if showSuggestions && suggestions.length > 0}
						<div
							class="overflow-y-auto absolute right-0 left-0 top-full z-50 mt-1 max-h-32 bg-white rounded-lg border border-gray-200 shadow-lg suggestions-dropdown dark:bg-gray-800 dark:border-gray-600"
							role="listbox"
							tabindex="-1"
							on:mousedown={handleSuggestionMouseDown}
						>
							{#each suggestions as suggestion, index}
								<button
									class="block px-3 py-2 w-full text-xs text-left suggestion-item hover:bg-gray-50 dark:hover:bg-gray-700"
									class:bg-blue-50={index ===
										selectedSuggestionIndex}
									class:selected={index ===
										selectedSuggestionIndex}
									role="option"
									aria-selected={index ===
										selectedSuggestionIndex}
									on:click={() =>
										selectSuggestion(suggestion)}
								>
									<span
										class="text-blue-500 dark:text-blue-400"
										>#</span
									>{suggestion}
								</button>
							{/each}
						</div>
					{/if}

					<!-- Simple action buttons -->
					<div
						class="flex absolute right-2 top-1/2 gap-1 items-center -translate-y-1/2"
					>
						{#if newTag.trim()}
							<button
								class="text-sm font-medium text-green-600 action-btn dark:text-green-400"
								on:click={addTag}
								title="Add tag"
							>
								✓
							</button>
						{/if}
						<button
							class="text-sm text-gray-400 action-btn dark:text-gray-500"
							on:click={cancelAddTag}
							title="Cancel"
						>
							×
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style lang="postcss">
	.tag-manager {
		@apply w-full;
	}

	.tag-pill {
		/* Prevent layout shift when adding/removing tags */
		box-sizing: border-box;
	}

	.add-tag-btn {
		/* Ensure consistent sizing with tag pills */
		min-height: 28px;
		box-sizing: border-box;
	}

	.tag-input-container {
		/* Match the height of other tag elements */
		min-height: 28px;
	}

	.tag-input {
		/* Ensure input field matches tag pill height */
		height: 28px;
		box-sizing: border-box;
		padding-right: 50px; /* Space for action buttons */
	}

	.action-btn {
		/* Simple action buttons */
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.suggestion-item.selected {
		@apply bg-blue-50;
	}

	:global(.dark) .suggestion-item.selected {
		@apply bg-blue-900/20;
	}

	/* Responsive design */
	@media (max-width: 640px) {
		.tag-input {
			min-width: 120px;
		}
	}
</style>
