<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { TFile, Notice } from "obsidian";
	import FileTab from "./FileTab.svelte";

	export let contextTabs: { file: TFile; path: string }[] = [];
	export let activeNoteContextTabIndex: number = -1;
	export let currentFileIsInTabs: boolean = false;
	export let obsidianActiveFileName: string = "";
	export let plugin: any;

	const dispatch = createEventDispatcher();

	function selectTab(index: number) {
		dispatch("tabSelected", { index });
	}

	function closeTab(index: number, event?: MouseEvent) {
		dispatch("tabClosed", { index, event });
	}

	function openFileInNewTab(file: TFile) {
		dispatch("openInObsidian", { file });
	}

	function addCurrentFile() {
		const currentActiveFile = plugin.app.workspace.getActiveFile();

		if (currentActiveFile && currentActiveFile.extension === "md") {
			dispatch("addCurrentFile", { file: currentActiveFile });

			new Notice(`Added "${currentActiveFile.basename}" to chat tabs`);
		} else {
			new Notice("No markdown file is currently active in Obsidian");
		}
	}
</script>

<div
	class="bg-gray-100 border-b border-gray-200 dark:bg-gray-700 dark:border-gray-600"
>
	<div class="flex flex-wrap items-center gap-2 px-3 py-2">
		{#if contextTabs.length === 0}
			<div class="px-3 py-1 text-sm text-gray-500 dark:text-gray-400">
				No files open - search or add a note to start
			</div>
		{:else}
			{#each contextTabs as tab, index}
				<FileTab
					file={tab.file}
					isActive={index === activeNoteContextTabIndex}
					on:select={() => selectTab(index)}
					on:close={(e) => closeTab(index, e.detail)}
					on:openInObsidian={() => openFileInNewTab(tab.file)}
				/>
			{/each}
		{/if}

		<!-- Add Current File button - only show if active file is not in tabs -->
		{#if !currentFileIsInTabs && plugin.app.workspace.getActiveFile()?.extension === "md"}
			<button
				type="button"
				class="flex items-center px-3 py-1.5 mr-1 rounded-lg text-sm truncate max-w-[180px] backdrop-blur-sm bg-green-500/20 border border-green-400/30 text-green-700 dark:text-green-300 hover:bg-green-500/30 hover:border-green-400/40 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-200"
				on:click={addCurrentFile}
				title="Add '{obsidianActiveFileName}' to tabs"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-3.5 h-3.5 mr-1 flex-shrink-0"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
					></path>
					<polyline points="14 2 14 8 20 8"></polyline>
					<line x1="9" y1="13" x2="15" y2="13"></line>
					<line x1="12" y1="10" x2="12" y2="16"></line>
				</svg>
				<span class="truncate"
					>{obsidianActiveFileName.length > 15
						? obsidianActiveFileName.substring(0, 12) + "..."
						: obsidianActiveFileName}</span
				>
			</button>
		{/if}
	</div>
</div>
