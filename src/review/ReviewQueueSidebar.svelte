<script lang="ts">
	import { TFile, Notice } from "obsidian";
	import {
		addMinutes,
		BATCH_SIZE,
		createFlashcardModal,
		formatReviewDate,
		LEARNING_STEPS,
		shuffleArray,
	} from "../flashcard/FlashcardManager";
	import Fuse from "fuse.js";
	import { onMount } from "svelte";
	import type SampleNotePlugin from "../main";
	import SearchInput from "./components/SearchInput.svelte";
	import FilterButtons from "./components/FilterButtons.svelte";
	import Card from "./components/Card.svelte";
	import FilterRow from "./components/FilterRow.svelte";

	export let plugin: SampleNotePlugin;

	let filterMode = "due";
	let searchText = "";
	let tagFilter = "all";

	function getEmptyStateTitle() {
		return "You're all caught up!";
	}

	function getEmptyStateMessage() {
		return "No flashcards match the current filters.";
	}

	let cardsToDisplay: any[] = [];
	let uniqueTagsSet: Set<string> = new Set();
	const cardMetaCache = new Map();

	function getFilePathForCard(cardUUID: string) {
		return Object.keys(plugin.notes).find(
			(fp) => cardUUID in plugin.notes[fp].cards,
		);
	}

	function performSearchFiltering(cards: any[], searchText: string) {
		if (searchText.trim() === "") return cards;

		const fuse = new Fuse(cards, {
			keys: ["cardTitle", "cardContent"],
			threshold: 0.4,
		});
		return fuse.search(searchText.trim()).map((r) => r.item);
	}

	function fileHasTag(filePath: string, tagToCheck: string) {
		if (tagToCheck === "all") return true;

		const file = plugin.app.vault.getAbstractFileByPath(filePath);
		if (file && file instanceof TFile) {
			const fileCache = plugin.app.metadataCache.getFileCache(file);
			const tags = fileCache?.frontmatter?.tags;
			if (tags) {
				return Array.isArray(tags)
					? tags.includes(tagToCheck)
					: tags === tagToCheck;
			}
		}
		return false;
	}

	function collectUniqueTags() {
		if (!plugin || !plugin.notes) return new Set<string>();

		const tempTags = new Set<string>();
		for (const notePath in plugin.notes) {
			// Only include tags from files that have flashcards
			const noteData = plugin.notes[notePath];
			if (!noteData.cards || Object.keys(noteData.cards).length === 0) {
				continue; // Skip files with no flashcards
			}

			const file = plugin.app.vault.getAbstractFileByPath(notePath);
			if (file && file instanceof TFile) {
				const fileCache = plugin.app.metadataCache.getFileCache(file);
				const tags = fileCache?.frontmatter?.tags;
				if (tags) {
					if (Array.isArray(tags)) {
						tags.forEach((tag) => tempTags.add(tag));
					} else {
						tempTags.add(tags);
					}
				}
			}
		}
		return new Set(Array.from(tempTags).sort());
	}

	onMount(() => {
		if (plugin && plugin.notes) {
			uniqueTagsSet = collectUniqueTags();
		}
		renderUnifiedCards();

		const unregisterFileOpen = plugin.app.workspace.on(
			"file-open",
			async (file: TFile) => {
				if (file && file instanceof TFile) {
					await plugin.flashcardManager.syncFlashcardsForFile(file);
					renderUnifiedCards();

					const now = new Date().toISOString();
					if (!plugin.notes[file.path]) {
						plugin.notes[file.path] = {
							cards: {},
							data: { noteVisitLog: [] },
						};
					}
					plugin.notes[file.path].data.noteVisitLog.push(now);
					await plugin.savePluginData();
				}
			},
		);

		const unregisterModify = plugin.app.vault.on(
			"modify",
			async (file: TFile) => {
				const activeFile = plugin.app.workspace.getActiveFile();
				if (activeFile && file.path === activeFile.path) {
					setTimeout(async () => {
						await plugin.flashcardManager.syncFlashcardsForFile(
							file,
						);
						plugin.flashcardManager.refreshUnifiedQueue();
					}, 100);
				}
			},
		);

		const unregisterDelete = plugin.app.vault.on(
			"delete",
			(file: TFile) => {
				delete plugin.notes[file.path];
				plugin.savePluginData();
				plugin.flashcardManager.refreshUnifiedQueue();
			},
		);

		const unregisterRename = plugin.app.vault.on(
			"rename",
			async (file: TFile, oldPath: string) => {
				if (file instanceof TFile) {
					if (plugin.notes[oldPath]) {
						plugin.notes[file.path] = plugin.notes[oldPath];
						delete plugin.notes[oldPath];
						await plugin.savePluginData();
					}
					plugin.flashcardManager.refreshUnifiedQueue();
				}
			},
		);

		return () => {
			plugin.app.workspace.offref(unregisterFileOpen);
			plugin.app.vault.offref(unregisterModify);
			plugin.app.vault.offref(unregisterDelete);
			plugin.app.vault.offref(unregisterRename);
		};
	});

	function renderUnifiedCards() {
		if (!plugin || !plugin.notes) {
			cardsToDisplay = [];
			return;
		}

		// Refresh tags to ensure they're in sync with current flashcards
		uniqueTagsSet = collectUniqueTags();

		let allCards = [];
		for (const note of Object.values(plugin.notes)) {
			allCards.push(...Object.values(note.cards));
		}

		const now = new Date();
		let filteredCards = allCards;

		if (filterMode === "note") {
			const activeFile = plugin.app.workspace.getActiveFile();
			if (activeFile) {
				filteredCards = allCards.filter((card) => {
					const filePath = getFilePathForCard(card.cardUUID);
					return filePath === activeFile.path;
				});
			} else {
				filteredCards = [];
			}

			// Add tag filtering to note mode
			if (tagFilter !== "all") {
				filteredCards = filteredCards.filter((card) => {
					const filePath = getFilePathForCard(card.cardUUID);
					if (!filePath) return false;
					return fileHasTag(filePath, tagFilter);
				});
			}

			filteredCards = performSearchFiltering(filteredCards, searchText);
		} else if (filterMode === "all") {
			if (tagFilter !== "all") {
				filteredCards = filteredCards.filter((card) => {
					const filePath = getFilePathForCard(card.cardUUID);
					if (!filePath) return false;
					return fileHasTag(filePath, tagFilter);
				});
			}

			filteredCards = performSearchFiltering(filteredCards, searchText);
		} else {
			filteredCards = filteredCards.filter((card) => {
				if (!card.active || !card.nextReviewDate) return false;
				const reviewDate = new Date(card.nextReviewDate);
				return filterMode === "due"
					? reviewDate <= now
					: reviewDate > now;
			});

			if (tagFilter !== "all") {
				filteredCards = filteredCards.filter((card) => {
					const filePath = getFilePathForCard(card.cardUUID);
					if (!filePath) return false;
					return fileHasTag(filePath, tagFilter);
				});
			}

			filteredCards = performSearchFiltering(filteredCards, searchText);
		}
		cardsToDisplay = filteredCards;
	}

	function getCardMetaInfo(cardState: any, now: Date) {
		const cacheKey = `${cardState.cardUUID}_${cardState.nextReviewDate}_${cardState.lastReviewDate}_${cardState.ef}_${now.getTime()}`;

		if (cardMetaCache.has(cacheKey)) {
			return cardMetaCache.get(cacheKey);
		}

		let reviewDateText = "";
		if (cardState.nextReviewDate) {
			const nextReview = new Date(cardState.nextReviewDate);
			if (now < nextReview) {
				const formattedNextReview = formatReviewDate(nextReview, now);
				reviewDateText = `Next: ${formattedNextReview}`;
			} else {
				const lastReview = new Date(cardState.lastReviewDate);
				const formattedLastReview = formatReviewDate(lastReview, now);
				reviewDateText = `Last: ${formattedLastReview}`;
			}
		}

		const efValue = cardState.ef.toFixed(2);
		const efColorClass =
			cardState.ef >= 2.5
				? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
				: cardState.ef >= 1.8
					? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
					: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";

		const result = {
			reviewDateText,
			efText: efValue,
			efColorClass,
		};

		cardMetaCache.set(cacheKey, result);
		return result;
	}

	function showTopNotice(message: string, timeout = 4000) {
		return new Notice(message, timeout);
	}

	function getFilteredCardMetadata() {
		const now = new Date();
		let metadataList: Array<{
			uuid: string;
			filePath: string;
			cardTitle: string;
			nextReviewDate: string;
			ef: number;
			line: number;
		}> = [];

		if (!plugin || !plugin.notes) return [];

		for (const filePath in plugin.notes) {
			if (filterMode === "note") {
				const activeFile = plugin.app.workspace.getActiveFile();
				if (!activeFile || filePath !== activeFile.path) continue;
			}

			for (const cardUUID in plugin.notes[filePath].cards) {
				const card = plugin.notes[filePath].cards[cardUUID];

				if (
					filterMode !== "note" &&
					filterMode !== "all" &&
					card.nextReviewDate
				) {
					const reviewDate = new Date(card.nextReviewDate);
					const isRelevant =
						filterMode === "due"
							? reviewDate <= now
							: reviewDate > now;
					if (!isRelevant) continue;
				}

				if (tagFilter !== "all" && !fileHasTag(filePath, tagFilter)) {
					continue;
				}

				metadataList.push({
					uuid: cardUUID,
					filePath: filePath,
					cardTitle: card.cardTitle || "",
					nextReviewDate: card.nextReviewDate,
					ef: card.ef,
					line: card.line || 0,
				});
			}
		}

		if (searchText.trim() !== "") {
			const searchItems = metadataList.map((metadata) => ({
				uuid: metadata.uuid,
				cardTitle: metadata.cardTitle || "",
			}));
			metadataList = performSearchFiltering(searchItems, searchText)
				.map((result) =>
					metadataList.find((m) => m.uuid === result.uuid),
				)
				.filter(
					(item): item is NonNullable<typeof item> =>
						item !== undefined,
				);
		}

		metadataList.sort((a, b) => {
			const aDate = a.nextReviewDate
				? new Date(a.nextReviewDate).getTime()
				: 0;
			const bDate = b.nextReviewDate
				? new Date(b.nextReviewDate).getTime()
				: 0;
			if (aDate !== bDate) return aDate - bDate;
			return (a.ef || 0) - (b.ef || 0);
		});

		if (plugin.settings.randomizeFlashcards) {
			metadataList = shuffleArray(metadataList);
		}
		return metadataList;
	}

	async function loadCardBatch(
		metadata: Array<{
			uuid: string;
			filePath: string;
			cardTitle: string;
			nextReviewDate: string;
			ef: number;
			line: number;
		}>,
	) {
		const flashcards = [];
		if (!plugin || !plugin.notes) return [];

		for (const item of metadata) {
			const card = plugin.notes[item.filePath]?.cards[item.uuid];
			if (!card) continue;
			const file = plugin.app.vault.getAbstractFileByPath(item.filePath);
			flashcards.push({
				uuid: item.uuid,
				content: card.cardContent,
				noteTitle:
					file instanceof TFile ? file.basename : "Unknown Note",
				filePath: item.filePath,
				cardTitle: card.cardTitle,
				line: card.line,
				nextReviewDate: card.nextReviewDate,
				ef: card.ef,
			});
		}
		return flashcards;
	}

	async function launchReviewModal() {
		if (!plugin) return;
		const loadingNotice = showTopNotice("Preparing flashcards...", 0);
		try {
			const activeFile = plugin.app.workspace.getActiveFile();
			if (activeFile && activeFile instanceof TFile) {
				await plugin.flashcardManager.syncFlashcardsForFile(activeFile);
			}

			const now = new Date();
			const relevantFilePaths = [];
			if (plugin.notes) {
				for (const filePath in plugin.notes) {
					let fileHasRelevantCards = false;
					if (filterMode === "note") {
						if (activeFile && filePath === activeFile.path) {
							relevantFilePaths.push(filePath);
							break;
						}
					} else if (filterMode === "all") {
						if (
							tagFilter === "all" ||
							fileHasTag(filePath, tagFilter)
						) {
							relevantFilePaths.push(filePath);
						}
					} else {
						for (const cardUUID in plugin.notes[filePath].cards) {
							const card = plugin.notes[filePath].cards[cardUUID];
							if (!card.nextReviewDate) continue;
							const reviewDate = new Date(card.nextReviewDate);
							const isRelevant =
								filterMode === "due"
									? reviewDate <= now
									: reviewDate > now;
							if (isRelevant) {
								if (tagFilter !== "all") {
									if (fileHasTag(filePath, tagFilter)) {
										fileHasRelevantCards = true;
										break;
									}
								} else {
									fileHasRelevantCards = true;
									break;
								}
							}
						}
					}
					if (fileHasRelevantCards) relevantFilePaths.push(filePath);
				}
			}

			for (const filePath of relevantFilePaths) {
				const file = plugin.app.vault.getAbstractFileByPath(filePath);
				if (file && file instanceof TFile) {
					await plugin.flashcardManager.syncFlashcardsForFile(file);
				}
			}

			const cardMeta = getFilteredCardMetadata();
			if (cardMeta.length === 0) {
				loadingNotice.hide();
				showTopNotice("No flashcards match the current filters.");
				return;
			}

			const initialBatch = await loadCardBatch(
				cardMeta.slice(0, BATCH_SIZE),
			);
			loadingNotice.hide();

			const modalContext = {
				plugin: plugin,
				app: plugin.app,
				loadCardBatch: loadCardBatch,
				getFilteredCardMetadata: getFilteredCardMetadata,
				showTopNotice: showTopNotice,
				filterMode,
				searchText,
				tagFilter,
				refreshUnifiedQueue: function () {
					renderUnifiedCards();
				},
			};

			createFlashcardModal(
				plugin.app,
				initialBatch,
				plugin,
				true,
				cardMeta,
				modalContext,
			).open();
		} catch (error) {
			loadingNotice.hide();
			showTopNotice(`Error preparing flashcards: ${error.message}`);
			console.error("Error in launchReviewModal:", error);
		}
	}

	async function handleReset() {
		if (!plugin || !plugin.notes) return;

		if (
			!confirm(
				"Are you sure you want to reset all filtered flashcards? This action cannot be undone.",
			)
		) {
			return;
		}
		const now = new Date();
		const currentFilteredCards = cardsToDisplay;

		currentFilteredCards.forEach((card) => {
			const filePath = getFilePathForCard(card.cardUUID);
			if (
				filePath &&
				plugin.notes[filePath] &&
				plugin.notes[filePath].cards[card.cardUUID]
			) {
				const pluginCard = plugin.notes[filePath].cards[card.cardUUID];
				const originalCreatedAt =
					pluginCard.createdAt || now.toISOString();
				pluginCard.ef = 2.5;
				pluginCard.repetition = 0;
				pluginCard.interval = 0;
				pluginCard.lastReviewDate = now.toISOString();
				pluginCard.nextReviewDate = addMinutes(
					now,
					LEARNING_STEPS[0],
				).toISOString();
				pluginCard.active = true;
				pluginCard.isLearning = false;
				pluginCard.learningStep = undefined;
				pluginCard.efHistory = [
					{ timestamp: now.toISOString(), ef: 2.5, rating: 3 },
				];
				pluginCard.createdAt = originalCreatedAt;
			}
		});

		await plugin.savePluginData();
		showTopNotice("All filtered flashcards reset successfully.");

		plugin.flashcardManager.refreshUnifiedQueue();
	}

	export function refreshView() {
		uniqueTagsSet = collectUniqueTags();
		renderUnifiedCards();
	}
</script>

<div>
	<!-- Persistent filter header -->
	<div
		class="top-0 z-10 p-4 mb-6 bg-white rounded-lg shadow-md dark:bg-gray-800"
	>
		<div class="space-y-4">
			<!-- Review Button Container -->
			<div class="mb-2">
				<button
					class="px-3 py-2 w-full font-medium text-center text-white bg-indigo-600 rounded-md shadow-none dark:bg-indigo-500"
					on:click={launchReviewModal}
				>
					Review
				</button>
			</div>

			<!-- Mode Button Container -->
			<FilterButtons
				bind:filterMode
				onFilterChange={(mode) => {
					filterMode = mode;
					renderUnifiedCards();
				}}
			/>

			<!-- Filter Row -->
			<FilterRow
				bind:tagFilter
				bind:searchText
				{uniqueTagsSet}
				onFilterChange={renderUnifiedCards}
			/>
		</div>
	</div>

	<!-- Card Container -->
	<div class="flex flex-col gap-4 mt-4">
		<div class="flex justify-center">
			<div
				class="text-sm font-medium text-center text-indigo-600 dark:text-indigo-400"
			>
				{cardsToDisplay.length} flashcard{cardsToDisplay.length === 1
					? ""
					: "s"}
			</div>
		</div>

		{#if cardsToDisplay.length === 0}
			<!-- Empty state -->
			<div
				class="flex flex-col justify-center items-center p-10 text-center"
			>
				<h3
					class="mb-2 text-xl font-bold text-gray-800 dark:text-gray-200"
				>
					{getEmptyStateTitle()}
				</h3>
				<p class="text-gray-600 dark:text-gray-400">
					{getEmptyStateMessage()}
				</p>
			</div>
		{:else}
			{#each cardsToDisplay as cardState (cardState.cardUUID)}
				{@const filePath = getFilePathForCard(cardState.cardUUID) || ""}
				{@const file = plugin.app.vault.getAbstractFileByPath(filePath)}
				{@const now = new Date()}
				{@const cardMeta = getCardMetaInfo(cardState, now)}
				{#if file && file instanceof TFile}
					<Card {plugin} {cardState} {filePath} {file} {cardMeta} />
				{/if}
			{/each}
		{/if}

		{#if cardsToDisplay.length > 0}
			<div class="flex justify-center mt-6 mb-4">
				<button
					class="flex justify-center items-center p-1.5 px-4 py-2 text-white bg-red-500 rounded-lg shadow-none dark:bg-red-600"
					on:click={handleReset}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mr-1 w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M3 2v6h6"></path>
						<path d="M3 13a9 9 0 1 0 3-7.7L3 8"></path>
					</svg>
					Reset Filtered Cards
				</button>
			</div>
		{/if}
	</div>
</div>
