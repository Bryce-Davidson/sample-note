<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from "svelte";
	import { TFile } from "obsidian";
	import Fuse from "fuse.js";

	export let plugin: any;

	const dispatch = createEventDispatcher();

	let fileSearchEl: HTMLInputElement;
	let fileSearchResultsEl: HTMLElement;
	let fileSearchResults: TFile[] = [];
	let fuse: Fuse<TFile>;
	let showSearchResults = false;

	onMount(() => {
		initializeFuse();
		document.addEventListener("click", handleDocumentClick);
	});

	onDestroy(() => {
		document.removeEventListener("click", handleDocumentClick);
	});

	function initializeFuse() {
		const files = plugin.app.vault.getFiles();
		const markdownFiles = files.filter((f: TFile) => f.extension === "md");

		fuse = new Fuse(markdownFiles, {
			keys: ["path", "name"],
			threshold: 0.4,
			ignoreLocation: true,
		});
	}

	function handleDocumentClick(e: MouseEvent) {
		if (
			fileSearchResultsEl &&
			!fileSearchResultsEl.contains(e.target as Node) &&
			e.target !== fileSearchEl
		) {
			showSearchResults = false;
		}
	}

	function handleFileSearchInput(e: Event) {
		if (!fileSearchEl) return;

		const query = (e.target as HTMLInputElement).value.trim();

		if (query.length === 0) {
			showSearchResults = false;
			return;
		}
		fileSearchResults = fuse.search(query).map((result) => result.item);
		showSearchResults = true;
	}

	function handleFileSearchClick() {
		if (!fileSearchEl) return;

		fileSearchEl.focus();

		setTimeout(() => {
			if (fileSearchEl) {
				fileSearchEl.value = "";
			}
		}, 10);

		const files = plugin.app.vault
			.getFiles()
			.filter((f: TFile) => f.extension === "md");

		fileSearchResults = files;
		showSearchResults = true;
	}

	function selectFile(file: TFile) {
		if (!file || !file.path) {
			console.warn("Cannot select file - invalid file object");
			return;
		}

		dispatch("fileSelected", { file });

		if (fileSearchEl) {
			fileSearchEl.value = "";
		}
		showSearchResults = false;
	}

	function clearChat() {
		dispatch("clearChat");
	}
</script>

<div
	class="p-3 bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700"
>
	<div class="relative flex items-center w-full gap-2">
		<div class="w-full">
			<div class="relative">
				<input
					id="file-search"
					type="text"
					placeholder="Search notes..."
					class="block w-full py-2 pl-3 pr-8 text-sm text-gray-700 transition-all duration-200 border rounded-lg outline-none backdrop-blur-sm bg-white/10 dark:bg-black/10 border-white/20 dark:border-black/20 dark:text-gray-300 focus:outline focus:outline-2 focus:outline-blue-500 sm:py-1"
					bind:this={fileSearchEl}
					on:input={handleFileSearchInput}
					on:click={handleFileSearchClick}
				/>
				<div
					class="absolute right-2 top-2 sm:top-1.5 text-gray-400 dark:text-gray-500 pointer-events-none"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="11" cy="11" r="8"></circle>
						<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
					</svg>
				</div>
			</div>
			<div
				class="absolute z-20 w-full mt-1 backdrop-blur-sm bg-white/10 dark:bg-black/10 border border-white/20 dark:border-black/20 rounded-lg shadow-lg max-h-60 overflow-y-auto transition-all duration-200 {showSearchResults
					? ''
					: 'hidden'}"
				bind:this={fileSearchResultsEl}
			>
				{#if fileSearchResults.length === 0}
					<div class="p-2 text-sm text-gray-500 dark:text-gray-400">
						No matching notes found
					</div>
				{:else}
					{#each fileSearchResults as file}
						<button
							type="button"
							class="flex items-center w-full p-2 text-sm text-left text-gray-700 transition-all duration-200 border rounded-lg backdrop-blur-sm bg-white/5 dark:bg-black/5 border-white/10 dark:border-black/10 dark:text-gray-300 hover:bg-indigo-500/10 hover:border-indigo-400/20 hover:text-indigo-700 dark:hover:text-indigo-30"
							on:click={() => selectFile(file)}
						>
							<span class="flex-shrink-0 mr-2 text-gray-500">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="w-4 h-4"
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
									<polyline points="14 2 14 8 20 8"
									></polyline>
									<line x1="9" y1="13" x2="15" y2="13"></line>
									<line x1="12" y1="10" x2="12" y2="16"
									></line>
								</svg>
							</span>
							<span class="truncate">{file.path}</span>
						</button>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Clear Chat button -->
		<button
			class="flex items-center justify-center h-[38px] w-[38px] sm:h-[30px] sm:w-[30px] backdrop-blur-sm bg-green-500/20 border border-green-400/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-500/30 hover:border-green-400/40 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-200"
			on:click={clearChat}
			title="Clear Chat"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 512 512"
				class="w-4 h-4 fill-current"
			>
				<!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.-->
				<path
					d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160L0 416c0 53 43 96 96 96l256 0c53 0 96-43 96-96l0-96c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 96c0 17.7-14.3 32-32 32L96 448c-17.7 0-32-14.3-32-32l0-256c0-17.7 14.3-32 32-32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L96 64z"
				/>
			</svg>
		</button>
	</div>
</div>
