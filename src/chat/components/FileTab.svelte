<script lang="ts">
	import { TFile } from "obsidian";

	export let file: TFile;
	export let isActive: boolean = false;

	let isHovering = false;
	let isHoveringOpenButton = false;
	let isHoveringCloseButton = false;

	import { createEventDispatcher } from "svelte";
	const dispatch = createEventDispatcher();

	function handleClose(event: MouseEvent) {
		event.stopPropagation();
		dispatch("close", event);
	}

	function handleClick() {
		dispatch("select");
	}

	function handleOpenInObsidian(event: MouseEvent) {
		event.stopPropagation();
		dispatch("openInObsidian");
	}

	function handleMouseEnter() {
		isHovering = true;
	}

	function handleMouseLeave() {
		isHovering = false;
	}

	function handleOpenButtonMouseEnter() {
		isHoveringOpenButton = true;
	}

	function handleOpenButtonMouseLeave() {
		isHoveringOpenButton = false;
	}

	function handleCloseButtonMouseEnter() {
		isHoveringCloseButton = true;
	}

	function handleCloseButtonMouseLeave() {
		isHoveringCloseButton = false;
	}

	$: shouldShowSelect =
		isHovering &&
		!isHoveringOpenButton &&
		!isHoveringCloseButton &&
		!isActive;
</script>

<button
	type="button"
	class="group flex items-center px-3 py-1.5 rounded-lg text-sm max-w-[180px] transition-all duration-200 backdrop-blur-sm {isActive
		? 'bg-indigo-500/20 border border-indigo-400/30 text-indigo-700 dark:text-indigo-300 shadow-lg shadow-indigo-500/10'
		: 'bg-white/10 dark:bg-black/10 border border-white/20 dark:border-black/20 text-gray-700 dark:text-gray-300 hover:bg-white/20 dark:hover:bg-black/20 hover:border-white/30 dark:hover:border-black/30 hover:shadow-md'}"
	on:click={handleClick}
	on:mouseenter={handleMouseEnter}
	on:mouseleave={handleMouseLeave}
>
	{#if isHovering}
		<!-- Open in obsidian button -->
		<button
			class="flex-shrink-0 mr-1.5 p-1 rounded-md transition-all duration-150 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/20 dark:hover:bg-black/20"
			on:click={handleOpenInObsidian}
			aria-label="Open in new tab"
			title="Open in new tab"
			on:mouseenter={handleOpenButtonMouseEnter}
			on:mouseleave={handleOpenButtonMouseLeave}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 512 512"
				class="w-3 h-3 fill-current"
			>
				<path
					d="M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l82.7 0L201.4 265.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3l0 82.7c0 17.7 14.3 32 32 32s32-14.3 32-32l0-160c0-17.7-14.3-32-32-32L320 0zM80 32C35.8 32 0 67.8 0 112L0 432c0 44.2 35.8 80 80 80l320 0c44.2 0 80-35.8 80-80l0-112c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 112c0 8.8-7.2 16-16 16L80 448c-8.8 0-16-7.2-16-16l0-320c0-8.8 7.2-16 16-16l112 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L80 32z"
				/>
			</svg>
		</button>
	{/if}

	<!-- File name container with width preservation -->
	<div class="relative flex-1 min-w-0">
		<!-- Hidden filename to preserve width -->
		<span class="invisible block font-medium truncate">{file.basename}</span
		>

		<!-- Visible conditional text that overlays the invisible text -->
		<span
			class="absolute inset-0 block truncate font-medium transition-colors duration-150 {shouldShowSelect
				? 'text-indigo-600 dark:text-indigo-400'
				: isActive
					? 'text-indigo-700 dark:text-indigo-300'
					: 'text-gray-700 dark:text-gray-300'}"
		>
			{#if isHoveringOpenButton}
				<span class="text-indigo-600 dark:text-indigo-400">open</span>
			{:else if shouldShowSelect}
				<span class="text-indigo-600 dark:text-indigo-400">select</span>
			{:else}
				{file.basename}
			{/if}
		</span>
	</div>

	<!-- Close button -->
	<button
		class="p-1 ml-2 text-gray-500 transition-all duration-150 rounded-md dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 hover:border-red-400/20"
		on:click={handleClose}
		aria-label="Close tab"
		title="Close tab"
		on:mouseenter={handleCloseButtonMouseEnter}
		on:mouseleave={handleCloseButtonMouseLeave}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="w-3.5 h-3.5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<line x1="18" y1="6" x2="6" y2="18"></line>
			<line x1="6" y1="6" x2="18" y2="18"></line>
		</svg>
	</button>
</button>
