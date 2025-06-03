import { ItemView, WorkspaceLeaf } from "obsidian";
import OcclusionEditor from "./OcclusionEditor.svelte";
import type MyPlugin from "../main";
import { createShadowRoot } from "../vite";

/**
 * A lightweight wrapper that mounts the Svelte UI into the Obsidian view.
 * Replaces the original OcclusionView class with a Svelte-based implementation.
 */
export class SvelteOcclusionEditorView extends ItemView {
	private component: OcclusionEditor | null = null;
	private plugin: MyPlugin;
	private selectedFilePath: string | null = null;
	private isComponentMounted: boolean = false;
	private isViewActive: boolean = false;
	private shadowRoot: ShadowRoot | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
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
		if (this.component && this.isComponentMounted) {
			setTimeout(() => {
				this.onResize();
			}, 0);
		}
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
			componentContainer.style.width = "100%";
			componentContainer.style.height = "100%";
			componentContainer.style.display = "flex";
			componentContainer.style.flexDirection = "column";

			this.shadowRoot.appendChild(componentContainer);

			this.isComponentMounted = false;
			this.component = new OcclusionEditor({
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

		this.isViewActive =
			this.leaf.view === this.app.workspace.getActiveViewOfType(ItemView);
	}

	private setupComponentEventListeners(): void {
		if (!this.component) return;

		this.component.$on("component_mounted", () => {
			this.isComponentMounted = true;
			console.debug("Occlusion editor component mounted");

			setTimeout(() => {
				window.dispatchEvent(new Event("resize"));
			}, 50);
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
		window.dispatchEvent(new Event("resize"));
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
			componentContainer.style.width = "100%";
			componentContainer.style.height = "100%";
			componentContainer.style.display = "flex";
			componentContainer.style.flexDirection = "column";
			componentContainer.style.position = "absolute";
			componentContainer.style.left = "0";
			componentContainer.style.top = "0";
			componentContainer.style.right = "0";
			componentContainer.style.bottom = "0";
			componentContainer.style.overflow = "hidden";

			this.shadowRoot.appendChild(componentContainer);

			this.component = new OcclusionEditor({
				target: componentContainer,
				props: {
					plugin: this.plugin,
				},
			});

			this.setupComponentEventListeners();

			if (currentFilePath) {
				this.setSelectedFile(currentFilePath);
			}

			setTimeout(() => {
				window.dispatchEvent(new Event("resize"));
			}, 100);
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
