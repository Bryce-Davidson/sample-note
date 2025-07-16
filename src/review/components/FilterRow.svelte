<script lang="ts">
	import SearchInput from "./SearchInput.svelte";
	import TagSelector from "./TagSelector.svelte";

	export let tagFilter: string;
	export let uniqueTagsSet: Set<string>;
	export let searchText: string;
	export let onFilterChange: () => void;
</script>

<div class="flex flex-col gap-4 mb-2">
	<!-- Tag Filter -->
	<TagSelector
		bind:value={tagFilter}
		{uniqueTagsSet}
		on:change={onFilterChange}
	/>

	<!-- Search Input -->
	<SearchInput bind:searchText onSearch={onFilterChange} />
</div>
