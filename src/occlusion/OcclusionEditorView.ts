import { ItemView, WorkspaceLeaf } from "obsidian";
import OcclusionEditor from "./OcclusionEditor.svelte";
import type SampleNotePlugin from "../main";
import { createShadowRoot } from "../vite";

/**
 * A lightweight wrapper that mounts the Svelte UI into the Obsidian view.
 * Replaces the original OcclusionView class with a Svelte-based implementation.
 */
export class SvelteOcclusionEditorView extends ItemView {
	private component: OcclusionEditor | null = null;
	private plugin: SampleNotePlugin;
	private selectedFilePath: string | null = null;
	private isComponentMounted: boolean = false;
	private isViewActive: boolean = false;
	private shadowRoot: ShadowRoot | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: SampleNotePlugin) {
		super(leaf);
		this.plugin = plugin;

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				const isActive = leaf === this.leaf;
				this.handleViewActiveChange(isActive);
			})
		);
	}

	getViewType(): string {
		return VIEW_TYPE_OCCLUSION;
	}

	getDisplayText(): string {
		return "Occlusion Editor";
	}

	getIcon(): string {
		return "image-file";
	}

	private handleViewActiveChange(isActive: boolean): void {
		if (this.isViewActive !== isActive) {
			this.isViewActive = isActive;

			if (isActive) {
				this.onViewActivate();
			} else {
				this.onViewDeactivate();
			}
		}
	}

	private onViewActivate(): void {
		// Component will handle its own resizing via ResizeObserver
		// No need to trigger additional resize here
	}

	private onViewDeactivate(): void {}

	async onOpen(): Promise<void> {
		this.cleanupComponent();

		const bodyContainer = this.containerEl.children[1] as
			| HTMLElement
			| undefined;
		const targetEl = bodyContainer ?? this.containerEl;

		if (targetEl instanceof HTMLElement) {
			targetEl.empty();
			targetEl.addClass("occlusion-editor-view");

			this.shadowRoot = createShadowRoot(targetEl);

			const componentContainer = document.createElement("div");
			componentContainer.addClass("occlusion-component-container");

			this.shadowRoot.appendChild(componentContainer);

			this.isComponentMounted = false;
			this.component = new OcclusionEditor({
				target: componentContainer,
				props: {
					plugin: this.plugin,
					selectedFilePath: this.selectedFilePath ?? "",
				},
			});

			this.setupComponentEventListeners();

			// Let the ResizeObserver handle the initial sizing
			// Remove redundant window resize event
		}

		this.handleViewActiveChange(
			this.leaf.view === this.app.workspace.getActiveViewOfType(ItemView)
		);
	}

	private setupComponentEventListeners(): void {
		if (!this.component) return;

		this.component.$on("component_mounted", () => {
			this.isComponentMounted = true;
			console.debug("Occlusion editor component mounted");
			// ResizeObserver will handle sizing
		});

		this.component.$on("component_destroyed", () => {
			this.isComponentMounted = false;
			console.debug("Occlusion editor component destroyed");
		});

		this.component.$on("occlusion_saved", () => {});

		this.component.$on("occlusion_loaded", () => {});
	}

	async onClose(): Promise<void> {
		this.cleanupComponent();
		this.isComponentMounted = false;
		this.isViewActive = false;
		this.shadowRoot = null;
	}

	private cleanupComponent(): void {
		if (this.component) {
			try {
				if (this.isComponentMounted && this.selectedFilePath) {
				}
				this.component.$destroy();
			} catch (e) {
				console.error(
					"Error destroying occlusion editor component:",
					e
				);
			}
			this.component = null;
		}
	}

	onResize(): void {
		// ResizeObserver handles all resizing automatically
	}

	private refreshView(): void {
		const currentFilePath = this.selectedFilePath;

		this.cleanupComponent();
		this.isComponentMounted = false;

		const bodyContainer = this.containerEl.children[1] as
			| HTMLElement
			| undefined;
		const targetEl = bodyContainer ?? this.containerEl;

		if (targetEl instanceof HTMLElement) {
			targetEl.empty();
			targetEl.addClass("occlusion-editor-view");

			this.shadowRoot = createShadowRoot(targetEl);

			const componentContainer = document.createElement("div");
			componentContainer.addClass(
				"occlusion-component-container-absolute"
			);

			this.shadowRoot.appendChild(componentContainer);

			this.component = new OcclusionEditor({
				target: componentContainer,
				props: {
					plugin: this.plugin,
					selectedFilePath: this.selectedFilePath ?? "",
				},
			});

			this.setupComponentEventListeners();

			if (currentFilePath) {
				this.setSelectedFile(currentFilePath);
			}

			// ResizeObserver will handle sizing
		}
	}

	public setSelectedFile(filePath: string): void {
		this.selectedFilePath = filePath;
		if (this.component) {
			this.component.$set({
				selectedFilePath: filePath,
			});
		}
	}
}

export const VIEW_TYPE_OCCLUSION = "occlusion-editor";
