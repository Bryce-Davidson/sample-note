<script lang="ts">
	import FlashcardCreationButtons from "./FlashcardCreationButtons.svelte";

	export let colorValue: string;
	export let clickAndDragOcclusionMode: boolean;
	export let onCreateHideAllFlashcard: () => void;
	export let onCreateHideOneFlashcard: () => void;
	export let onAddRectangle: () => void;
	export let onToggleClickAndDragMode: () => void;
	export let onUpdateSelectedRectangleColor: () => void;
</script>

<div class="flex flex-wrap items-center justify-between gap-2 p-2">
	<!-- Left: Drawing tools -->
	<div class="flex flex-wrap items-center gap-1 mb-2 sm:mb-0">
		<button
			class="p-1.5 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 border border-transparent shadow-none bg-transparent"
			on:click={onAddRectangle}
			title="Add Rectangle"
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
				<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
				<line x1="12" y1="8" x2="12" y2="16"></line>
				<line x1="8" y1="12" x2="16" y2="12"></line>
			</svg>
		</button>
		<button
			class="p-1.5 rounded-lg flex items-center justify-center {clickAndDragOcclusionMode
				? 'text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
				: 'text-gray-500 dark:text-gray-400 border-transparent'} border shadow-none"
			title="Select Tool - Click and Drag to Create Occlusion"
			on:click={onToggleClickAndDragMode}
			data-plugin="sample-note"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="!w-4 !h-4"
				viewBox="0 0 320 512"
				fill="currentColor"
			>
				<path
					d="M0 55.2L0 426c0 12.2 9.9 22 22 22c6.3 0 12.4-2.7 16.6-7.5L121.2 346l58.1 116.3c7.9 15.8 27.1 22.2 42.9 14.3s22.2-27.1 14.3-42.9L179.8 320l118.1 0c12.2 0 22.1-9.9 22.1-22.1c0-6.3-2.7-12.3-7.4-16.5L38.6 37.9C34.3 34.1 28.9 32 23.2 32C10.4 32 0 42.4 0 55.2z"
				/>
			</svg>
		</button>

		<div class="w-px h-6 mx-1 bg-gray-300 dark:bg-gray-600"></div>

		<div class="flex items-center">
			<div
				class="color-picker-container rounded-lg flex items-center justify-center border border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 p-1.5 relative w-8 h-8"
				data-plugin="sample-note"
			>
				<div
					class="absolute inset-0 z-0 flex items-center justify-center pointer-events-none"
				>
					<div
						class="color-btn-preview"
						style="background-color: {colorValue}; width: 20px; height: 20px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.2); box-shadow: 0 1px 2px rgba(0,0,0,0.1);"
					></div>
				</div>
				<input
					id="occlusion-color"
					type="color"
					class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
					bind:value={colorValue}
					on:change={onUpdateSelectedRectangleColor}
					title="Select Color"
					data-plugin="sample-note"
				/>
			</div>
		</div>
	</div>

	<!-- Center: Flashcard creation buttons -->
	<FlashcardCreationButtons
		{onCreateHideAllFlashcard}
		{onCreateHideOneFlashcard}
	/>
</div>
