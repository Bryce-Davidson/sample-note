<script lang="ts">
	export let searchText: string;
	export let onSearch: (text: string) => void;
</script>

<div class="relative w-full">
	<input
		class="block w-full p-2 text-sm text-gray-900 transition-colors bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white"
		placeholder="Search flashcards..."
		type="search"
		style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden; min-height: 2.5rem;"
		bind:value={searchText}
		on:input={() => onSearch(searchText)}
	/>
</div>
