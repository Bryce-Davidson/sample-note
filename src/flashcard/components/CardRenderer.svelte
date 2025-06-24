<script lang="ts">
	import { createEventDispatcher, onMount } from "svelte";
	import { MarkdownRenderer } from "obsidian";
	import type SampleNotePlugin from "../../main";
	import type { Flashcard } from "../../types";
	import {
		findCardStateAndFile,
		processCustomHiddenText,
	} from "../FlashcardManager";
	import OcclusionCard from "./OcclusionCard.svelte";
	import ErrorDisplay from "./ErrorDisplay.svelte";

	export let plugin: SampleNotePlugin;
	export let flashcard: Flashcard;
	export let contentWrapper: HTMLElement;

	const dispatch = createEventDispatcher<{
		skip: void;
		close: void;
	}>();

	let error: {
		message: string;
		filePath?: string;
		line?: number;
		cardTitle?: string;
	} | null = null;
	let currentComponent: any = null;
	let isRendering: boolean = false;

	$: cardStateAndFile = flashcard
		? findCardStateAndFile(plugin, flashcard.uuid)
		: null;

	function handleInternalLink(evt: MouseEvent) {
		evt.preventDefault();
		const href = (evt.currentTarget as HTMLAnchorElement).getAttribute(
			"href",
		);
		if (href) {
			plugin.app.workspace.openLinkText(href, "", false);
			dispatch("close");
		}
	}

	function processHideGroups(rootEl: HTMLElement, hideGroupId?: string) {
		if (!hideGroupId) return;

		// Find all hide elements with groups
		const groupElements = rootEl.querySelectorAll(
			".sample-note-hidable-element.group-hide",
		);
		// Find all hide elements without groups
		const nonGroupElements = rootEl.querySelectorAll(
			".sample-note-hidable-element:not(.group-hide)",
		);

		// Show only the specified hide group, hide all others
		groupElements.forEach((el) => {
			const group = el.getAttribute("data-group");
			if (group === hideGroupId) {
				// Show this group
				el.classList.remove("sample-note-is-hidden");
			} else {
				// Hide other groups
				el.classList.add("sample-note-is-hidden");
			}
		});

		// Hide all non-group hide elements
		nonGroupElements.forEach((el) => {
			el.classList.add("sample-note-is-hidden");
		});
	}

	function cleanup() {
		if (currentComponent) {
			currentComponent.$destroy();
			currentComponent = null;
		}
		error = null;
	}

	async function renderCard() {
		if (!contentWrapper || !flashcard) {
			error = { message: "No flashcard available." };
			return;
		}

		isRendering = true;

		const tempContainer = document.createElement("div");
		tempContainer.setAttribute("data-flashcard-content", "true");
		tempContainer.addClass("sample-note-flashcard-temp-hidden");

		if (currentComponent) {
			currentComponent.$destroy();
			currentComponent = null;
		}

		try {
			if (cardStateAndFile?.card.occlusionData) {
				error = null;

				currentComponent = new OcclusionCard({
					target: tempContainer,
					props: {
						plugin: plugin,
						flashcard: flashcard,
						cardState: cardStateAndFile.card,
					},
				});

				currentComponent.$on(
					"error",
					(event: { detail: { message: string } }) => {
						error = {
							message: `Error rendering occlusion card: ${event.detail.message}`,
							filePath: flashcard.filePath,
							line: flashcard.line,
						};
						tempContainer.remove();
						isRendering = false;
					},
				);

				if (!error) {
					while (contentWrapper.firstChild) {
						contentWrapper.removeChild(contentWrapper.firstChild);
					}
					tempContainer.removeClass(
						"sample-note-flashcard-temp-hidden",
					);
					tempContainer.addClass(
						"sample-note-flashcard-temp-visible",
					);
					contentWrapper.appendChild(tempContainer);
				}
			} else {
				await MarkdownRenderer.render(
					plugin.app,
					flashcard.content,
					tempContainer,
					flashcard.filePath ?? "",
					plugin,
				);

				// Process all hidden text first to create the hide elements
				processCustomHiddenText(tempContainer, false);

				// Then apply hide group visibility if this is a hide group card
				if (cardStateAndFile?.card.hideGroupId) {
					processHideGroups(
						tempContainer,
						cardStateAndFile.card.hideGroupId,
					);
				}

				tempContainer
					.querySelectorAll("a.internal-link")
					.forEach((link) =>
						link.addEventListener("click", handleInternalLink),
					);

				error = null;

				while (contentWrapper.firstChild) {
					contentWrapper.removeChild(contentWrapper.firstChild);
				}
				tempContainer.removeClass("sample-note-flashcard-temp-hidden");
				tempContainer.addClass("sample-note-flashcard-temp-visible");
				contentWrapper.appendChild(tempContainer);
			}
		} catch (renderError) {
			error = {
				message: `Error rendering flashcard: ${renderError.message || "Unknown error"}`,
				filePath: flashcard.filePath,
				line: flashcard.line,
				cardTitle: flashcard.cardTitle,
			};
			tempContainer.remove();
		} finally {
			isRendering = false;
		}
	}

	onMount(() => {
		return () => {
			if (currentComponent) {
				currentComponent.$destroy();
				currentComponent = null;
			}
		};
	});

	$: if (flashcard) {
		renderCard();
	}
</script>

{#if error}
	<ErrorDisplay
		errorMessage={error.message}
		filePath={error.filePath}
		line={error.line}
		cardTitle={error.cardTitle}
		on:skip={() => dispatch("skip")}
	/>
{/if}
