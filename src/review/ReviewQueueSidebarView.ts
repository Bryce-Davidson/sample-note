/// <reference types="vite/client" />

import { ItemView, WorkspaceLeaf } from "obsidian";
import ReviewQueueSidebar from "./ReviewQueueSidebar.svelte";
import type SampleNotePlugin from "src/main";
import { createShadowRoot } from "../vite";

export const UNIFIED_VIEW_TYPE = "unified-queue-sidebar";

export class SvelteReviewQueueSidebarView extends ItemView {
	private component: ReviewQueueSidebar | null = null;
	readonly plugin: SampleNotePlugin;
	private shadowRoot: ShadowRoot | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: SampleNotePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return UNIFIED_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Review Queue";
	}

	getIcon(): string {
		return "file-text";
	}

	async onOpen(): Promise<void> {
		this.destroyComponent();

		const targetEl = this.containerEl.children[1] || this.containerEl;
		if (targetEl instanceof HTMLElement) {
			targetEl.empty();
			targetEl.addClass("review-queue-svelte-view");

			this.shadowRoot = createShadowRoot(targetEl);

			const componentContainer = document.createElement("div");
			componentContainer.classList.add(
				"review-queue-component-container"
			);

			this.shadowRoot.appendChild(componentContainer);

			this.component = new ReviewQueueSidebar({
				target: componentContainer,
				props: {
					plugin: this.plugin,
				},
			});

			this.setupComponentEventListeners();

			setTimeout(() => {
				window.dispatchEvent(new Event("resize"));
			}, 100);
		}
	}

	private setupComponentEventListeners(): void {
		if (!this.component) return;

		this.component.$on("component_mounted", () => {
			console.debug("Review queue component mounted");

			setTimeout(() => {
				window.dispatchEvent(new Event("resize"));
			}, 50);
		});
	}

	async onClose(): Promise<void> {
		this.destroyComponent();
		this.shadowRoot = null;
	}

	private destroyComponent(): void {
		if (this.component) {
			try {
				this.component.$destroy();
			} catch (e) {
				console.error(
					"Error destroying ReviewQueueSidebar Svelte component:",
					e
				);
			}
			this.component = null;
		}
	}

	onResize(): void {
		window.dispatchEvent(new Event("resize"));
	}

	public refreshData(): void {
		if (
			this.component &&
			typeof this.component.refreshView === "function"
		) {
			this.component.refreshView();
		} else {
			console.warn(
				"ReviewQueueSidebar component or refreshView method not available on component for refreshData call."
			);
		}
	}
}
