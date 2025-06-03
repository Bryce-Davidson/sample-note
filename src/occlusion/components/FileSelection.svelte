<script lang="ts">
	import { TFile } from "obsidian";
	import Fuse from "fuse.js";

	export let plugin: any;
	export let selectedFilePath = "";
	export let onFileSelect: (file: TFile) => void;

	let fileSearchEl: HTMLInputElement;
	let fileSearchResultsEl: HTMLElement;
	let fileSearchResults: TFile[] = [];
	let fuse: Fuse<TFile>;
	let showSearchResults = false;

	function initializeFuse() {
		const files = plugin.app.vault.getFiles();
		const imageFiles = files.filter((f: TFile) =>
			f.extension.match(/(png|jpe?g|gif)/i),
		);

		fuse = new Fuse(imageFiles, {
			keys: ["path", "name"],
			threshold: 0.4,
			ignoreLocation: true,
		});

		if (selectedFilePath) {
			const file =
				plugin.app.vault.getAbstractFileByPath(selectedFilePath);
			if (file instanceof TFile) {
				fileSearchEl.value = selectedFilePath;
				onFileSelect(file);
			}
		} else if (imageFiles.length > 0) {
			selectedFilePath = imageFiles[0].path;
			fileSearchEl.value = selectedFilePath;
			onFileSelect(imageFiles[0]);
		}
	}

	$: if (selectedFilePath && fileSearchEl) {
		fileSearchEl.value = selectedFilePath;
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
			.filter((f: TFile) => f.extension.match(/(png|jpe?g|gif)/i));

		fileSearchResults = files;
		showSearchResults = true;
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

	function selectFile(file: TFile) {
		if (!file || !file.path) {
			console.warn("Cannot select file - invalid file object");
			return;
		}

		if (!fileSearchEl) {
			console.warn(
				"Cannot select file - file search element not available",
			);
			return;
		}

		selectedFilePath = file.path;
		fileSearchEl.value = file.path;
		showSearchResults = false;
		onFileSelect(file);
	}

	import { onMount } from "svelte";

	onMount(() => {
		initializeFuse();
		document.addEventListener("click", handleDocumentClick);

		return () => {
			document.removeEventListener("click", handleDocumentClick);
		};
	});
</script>

<div class="relative flex items-center w-full gap-2 sm:max-w-xs">
	<div class="w-full">
		<div class="relative">
			<input
				id="file-search"
				type="text"
				placeholder="Search images..."
				class="block w-full py-2 pl-3 pr-8 text-sm text-gray-900 border border-gray-300 rounded-md sm:py-1 bg-gray-50 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
			class="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-600 max-h-60 overflow-y-auto {showSearchResults
				? ''
				: 'hidden'}"
			bind:this={fileSearchResultsEl}
		>
			{#if fileSearchResults.length === 0}
				<div class="p-2 text-sm text-gray-500 dark:text-gray-400">
					No matching images found
				</div>
			{:else}
				{#each fileSearchResults as file}
					<button
						type="button"
						class="flex items-center w-full p-2 text-sm text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
						on:click={() => selectFile(file)}
					>
						<span class="flex-shrink-0 mr-2 text-gray-500">
							<svg
								class="w-4 h-4"
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<rect
									x="3"
									y="3"
									width="18"
									height="18"
									rx="2"
									ry="2"
								></rect>
								<circle cx="8.5" cy="8.5" r="1.5"></circle>
								<polyline points="21 15 16 10 5 21"></polyline>
							</svg>
						</span>
						<span class="truncate">{file.path}</span>
					</button>
				{/each}
			{/if}
		</div>
	</div>
</div>
