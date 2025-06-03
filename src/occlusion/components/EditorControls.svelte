<script lang="ts">
	export let hasUnsavedChanges: boolean;
	export let onUndo: () => void;
	export let onRedo: () => void;
	export let onSave: () => void;
</script>

<div class="flex items-center gap-1 mt-2 sm:mt-0">
	<!-- Undo/Redo -->
	<button
		class="p-1.5 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 border border-transparent shadow-none bg-transparent"
		on:click={onUndo}
		title="Undo (Ctrl+Z)"
		data-plugin="sample-note"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="!w-4 !h-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M3 10h10a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5h-4"></path>
			<polyline points="3 10 9 4 3 10 9 16"></polyline>
		</svg>
	</button>
	<button
		class="p-1.5 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 border border-transparent shadow-none bg-transparent"
		on:click={onRedo}
		title="Redo (Ctrl+Shift+Z, Ctrl+Y)"
		data-plugin="sample-note"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="!w-4 !h-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M21 10H11a5 5 0 0 0-5 5v2a5 5 0 0 0 5 5h4"></path>
			<polyline points="21 10 15 4 21 10 15 16"></polyline>
		</svg>
	</button>

	<div class="w-px h-6 mx-1 bg-gray-300 dark:bg-gray-600"></div>

	<!-- Save Button with color change for unsaved changes -->
	<button
		class="p-1.5 rounded-lg flex items-center justify-center border border-transparent shadow-none bg-transparent {hasUnsavedChanges
			? 'text-blue-500 dark:text-blue-400'
			: 'text-gray-500 dark:text-gray-400'}"
		on:click={onSave}
		title="Save Occlusions"
		data-plugin="sample-note"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="!w-4 !h-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path
				d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
			></path>
			<polyline points="17 21 17 13 7 13 7 21"></polyline>
			<polyline points="7 3 7 8 15 8"></polyline>
		</svg>
	</button>
</div>
