<script lang="ts">
	import { createEventDispatcher } from "svelte";

	export let value: string;
	export let uniqueTagsSet: Set<string>;

	const dispatch = createEventDispatcher();

	let isOpen = false;
	let searchTerm = "";
	let dropdownElement: HTMLElement;
	let buttonElement: HTMLElement;
	let searchInputElement: HTMLInputElement;

	$: allTags = ["all", ...Array.from(uniqueTagsSet).sort()];
	$: filteredTags = allTags.filter(
		(tag) =>
			tag === "all" ||
			tag.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	$: selectedDisplayText = value === "all" ? "All Tags" : `#${value}`;

	function toggleDropdown() {
		isOpen = !isOpen;
		if (isOpen) {
			// Focus search input when dropdown opens
			requestAnimationFrame(() => {
				searchInputElement?.focus();
			});
		} else {
			searchTerm = "";
		}
	}

	function selectTag(tag: string) {
		value = tag;
		isOpen = false;
		searchTerm = "";
		dispatch("change");
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			isOpen = false;
			searchTerm = "";
			buttonElement?.focus();
		} else if (event.key === "Enter") {
			event.preventDefault();
			if (filteredTags.length > 0) {
				selectTag(filteredTags[0]);
			}
		} else if (event.key === "ArrowDown" && !isOpen) {
			event.preventDefault();
			isOpen = true;
		}
	}

	function handleWindowClick(event: MouseEvent) {
		if (
			dropdownElement &&
			!dropdownElement.contains(event.target as Node)
		) {
			isOpen = false;
			searchTerm = "";
		}
	}
</script>

<svelte:window on:click={handleWindowClick} />

<div class="relative w-full" bind:this={dropdownElement}>
	<!-- Main button that looks like the original select -->
	<button
		bind:this={buttonElement}
		class="block p-2 w-full text-sm text-left text-gray-900 bg-white rounded-lg border border-gray-300 transition-colors cursor-pointer dark:bg-gray-800 dark:border-gray-600 dark:text-white"
		style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden; min-height: 2.5rem;"
		on:click|stopPropagation={toggleDropdown}
		on:keydown={handleKeydown}
		aria-haspopup="listbox"
		aria-expanded={isOpen}
	>
		<span class="block truncate">{selectedDisplayText}</span>
	</button>

	<!-- Dropdown arrow (same as original) -->
	<div
		class="flex absolute inset-y-0 right-0 items-center px-2 text-gray-700 pointer-events-none dark:text-gray-300"
		class:rotate-180={isOpen}
		style="transition: transform 0.2s ease;"
	>
		<svg
			class="w-4 h-4 fill-current"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 20 20"
		>
			<path
				d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"
			/>
		</svg>
	</div>

	<!-- Dropdown menu -->
	{#if isOpen}
		<div
			class="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-300 shadow-lg dark:bg-gray-800 dark:border-gray-600"
			style="max-height: 300px;"
		>
			<!-- Search input -->
			<div class="p-2 border-b border-gray-300 dark:border-gray-600">
				<input
					bind:this={searchInputElement}
					bind:value={searchTerm}
					placeholder="Search tags..."
					class="px-2 py-1 w-full text-sm text-gray-900 bg-white rounded border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-0 focus:border-gray-300 dark:focus:border-gray-600"
					on:keydown={handleKeydown}
				/>
			</div>

			<!-- Tag list -->
			<div class="overflow-y-auto" style="max-height: 240px;">
				{#if filteredTags.length === 0}
					<div
						class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400"
					>
						No tags found
					</div>
				{:else}
					{#each filteredTags as tag (tag)}
						<button
							class="px-3 py-2 w-full text-sm text-left text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none"
							class:bg-indigo-50={value === tag}
							class:dark:bg-indigo-900={value === tag}
							class:text-indigo-600={value === tag}
							class:dark:text-indigo-400={value === tag}
							on:click|stopPropagation={() => selectTag(tag)}
						>
							<span class="block truncate">
								{tag === "all" ? "All Tags" : `#${tag}`}
							</span>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
