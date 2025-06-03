<script lang="ts">
	export let onCreateHideAllFlashcard: () => void;
	export let onCreateHideOneFlashcard: () => void;
</script>

<div class="flex items-center gap-1 mb-2 sm:mb-0">
	<button
		class="p-1.5 rounded-lg flex items-center justify-center text-blue-500 dark:text-blue-400 border border-transparent shadow-none bg-transparent px-2"
		title="Hide All Occlusions"
		data-plugin="sample-note"
		style="width: auto; min-width: 70px;"
		on:click={onCreateHideAllFlashcard}
	>
		<span class="text-xs font-medium">HideAll</span>
	</button>

	<button
		class="p-1.5 rounded-lg flex items-center justify-center text-green-500 dark:text-green-400 border border-transparent shadow-none bg-transparent px-2"
		title="Hide One Occlusion"
		data-plugin="sample-note"
		style="width: auto; min-width: 70px;"
		on:click={onCreateHideOneFlashcard}
	>
		<span class="text-xs font-medium">HideOne</span>
	</button>
</div>
