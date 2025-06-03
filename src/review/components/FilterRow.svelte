<script lang="ts">
	import SearchInput from "./SearchInput.svelte";

	export let tagFilter: string;
	export let uniqueTagsSet: Set<string>;
	export let searchText: string;
	export let onFilterChange: () => void;
</script>

<div class="flex flex-col gap-4 mb-2">
	<!-- Tag Filter -->
	<div class="relative w-full">
		<select
			class="block w-full p-2 text-sm text-gray-900 transition-colors bg-white border border-gray-300 rounded-lg cursor-pointer dark:bg-gray-800 dark:border-gray-600 dark:text-white"
			style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden; min-height: 2.5rem; appearance: none;"
			bind:value={tagFilter}
			on:change={onFilterChange}
		>
			<option value="all">All Tags</option>
			{#each Array.from(uniqueTagsSet) as tag (tag)}
				<option value={tag}>#{tag}</option>
			{/each}
		</select>
		<div
			class="absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 pointer-events-none dark:text-gray-300"
		>
			<svg
				class="w-4 h-4 fill-current"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				><path
					d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"
				/></svg
			>
		</div>
	</div>

	<!-- Search Input -->
	<SearchInput bind:searchText onSearch={onFilterChange} />
</div>
