import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import DrawingRoot from "./DrawingEditor.svelte";
import { App } from "obsidian";

export class DrawingCanvasView extends ItemView {
	private component: DrawingRoot | null = null;
	private plugin: any;
	private activeFilePath: string | null = null;

	constructor(leaf: WorkspaceLeaf, app: App, plugin: any) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_DRAWING;
	}

	getDisplayText(): string {
		if (this.activeFilePath) {
			const fileName =
				this.activeFilePath.split("/").pop()?.split(".")[0] ||
				this.activeFilePath;
			return `Drawing: ${fileName}`;
		}
		return "Drawing Canvas";
	}

	getIcon(): string {
		return "pencil";
	}

	async onOpen(): Promise<void> {
		const viewState = this.leaf.getViewState();
		const filePathProvidedInState = !!viewState.state?.filePath;
		this.activeFilePath = viewState.state?.filePath as string;

		if (!this.activeFilePath) {
			const markdownLeaves =
				this.app.workspace.getLeavesOfType("markdown");
			if (markdownLeaves.length > 0) {
				const firstMarkdownLeaf = markdownLeaves[0];
				const firstMarkdownViewState = firstMarkdownLeaf.getViewState();
				this.activeFilePath = firstMarkdownViewState.state
					?.file as string;

				if (this.activeFilePath && !filePathProvidedInState) {
					new Notice(
						`Using active markdown file: ${this.activeFilePath
							.split("/")
							.pop()}`,
						700
					);
				}
			}
		}

		this._rebuildComponent();
	}

	private async openInSidebarAndClose(): Promise<void> {
		let sidebarLeaf = this.app.workspace.getRightLeaf(false)!;

		await sidebarLeaf.setViewState({
			type: VIEW_TYPE_DRAWING,
			active: true,
			state: { filePath: this.activeFilePath },
		});

		this.app.workspace.revealLeaf(sidebarLeaf);

		if (this.activeFilePath) {
			try {
				const fileAlreadyOpen = this.app.workspace
					.getLeavesOfType("markdown")
					.find((leaf) => {
						const viewState = leaf.getViewState();
						return viewState.state?.file === this.activeFilePath;
					});

				if (fileAlreadyOpen) {
					this.app.workspace.revealLeaf(fileAlreadyOpen);
				} else {
					await this.app.workspace.openLinkText(
						this.activeFilePath,
						"",
						false,
						{ active: true }
					);
				}
			} catch (e) {
				new Notice(`Failed to open markdown file: ${e}`);
			}
		}

		this.leaf.detach();
	}

	private async openInMainAreaAndClose(): Promise<void> {
		let markdownLeaf = null;
		if (this.activeFilePath) {
			markdownLeaf = this.app.workspace
				.getLeavesOfType("markdown")
				.find((leaf) => {
					const viewState = leaf.getViewState();
					return viewState.state?.file === this.activeFilePath;
				});

			if (!markdownLeaf) {
				markdownLeaf = this.app.workspace.getLeaf(true);
				await this.app.workspace.openLinkText(
					this.activeFilePath,
					"",
					false,
					{ active: false }
				);
			}
		}

		const mainLeaf = this.app.workspace.getLeaf(true);

		await mainLeaf.setViewState({
			type: VIEW_TYPE_DRAWING,
			active: true,
			state: { filePath: this.activeFilePath },
		});

		this.app.workspace.revealLeaf(mainLeaf);

		this.leaf.detach();
	}

	private closeSidebar(): void {
		const rightSidebar = this.app.workspace.rightSplit;
		if (rightSidebar && rightSidebar.collapsed === false) {
			rightSidebar.collapse();
		}
	}

	public isInSidebar(): boolean {
		const leafContainer = (this.leaf as any).containerEl;

		const isRightSidebarDesktop =
			leafContainer.closest(".mod-right-split") !== null;

		const isRightSidebarMobile =
			leafContainer.closest(".is-tablet .mod-right") !== null ||
			leafContainer.closest("[data-type='sidebar']") !== null ||
			leafContainer.closest(".workspace-tabs.mod-right") !== null ||
			leafContainer.closest(".mod-right") !== null;

		const isTabletSidebar =
			document.body.classList.contains("is-tablet") &&
			this.app.workspace.rightSplit &&
			!this.app.workspace.rightSplit.collapsed;

		return isRightSidebarDesktop || isRightSidebarMobile || isTabletSidebar;
	}

	private setupComponentEventListeners(): void {
		if (!this.component) return;

		this.component.$on("drawing_saved", (event: CustomEvent) => {
			console.log("Drawing saved:", event.detail.filePath);
		});

		this.component.$on("canvas_interaction", (event: CustomEvent) => {
			const path = this.activeFilePath;
			if (path && this.plugin && !this.plugin.notes[path]) {
				this.plugin.notes[path] = {
					cards: {},
					data: { noteVisitLog: [] },
				};
			}
		});

		this.component.$on("component_mounted", () => {
			console.debug("Drawing component mounted");

			setTimeout(() => {
				window.dispatchEvent(new Event("resize"));
			}, 50);
		});
	}

	async onClose(): Promise<void> {
		this.cleanupComponent();
	}

	onResize(): void {
		window.dispatchEvent(new Event("resize"));
	}

	private cleanupComponent(): void {
		if (this.component) {
			try {
				if (this.activeFilePath && this.plugin) {
					this.component.$emit("drawing_saved", {
						filePath: this.activeFilePath,
						timestamp: Date.now(),
						manual: true,
					});
				}
				this.component.$destroy();
			} catch (e) {
				console.error("Error destroying drawing component:", e);
			}
			this.component = null;
		}
	}

	private _rebuildComponent(): void {
		this.cleanupComponent();

		const bodyContainer = this.containerEl.children[1] as
			| HTMLElement
			| undefined;
		const targetEl = bodyContainer ?? this.containerEl;

		if (targetEl instanceof HTMLElement) {
			targetEl.empty();
			targetEl.addClass("drawing-canvas-view");
		} else {
			console.error(
				"DrawingView: Target element not found or not an HTMLElement during rebuild."
			);
			return;
		}

		if (this.activeFilePath) {
			const componentContainer = document.createElement("div");
			componentContainer.addClass("drawing-canvas-container");
			componentContainer.setAttribute("data-canvas-container", "true");
			componentContainer.setAttribute("data-plugin", "sample-note");

			targetEl.appendChild(componentContainer);

			this.component = new DrawingRoot({
				target: componentContainer,
				props: {
					app: this.app,
					plugin: this.plugin,
					filePath: this.activeFilePath,
					openInSidebar: this.openInSidebarAndClose.bind(this),
					openInMainArea: this.openInMainAreaAndClose.bind(this),
					isInSidebar: this.isInSidebar.bind(this),
					closeSidebar: this.closeSidebar.bind(this),
				},
			});
			this.setupComponentEventListeners();

			setTimeout(() => {
				window.dispatchEvent(new Event("resize"));
			}, 100);
		} else {
			targetEl.setText("Open a note to start drawing or select a file.");
		}
	}

	public setSelectedFile(newFilePath: string): void {
		this.activeFilePath = newFilePath;
		this._rebuildComponent();
	}

	async setState(state: unknown, result: any): Promise<void> {
		if (state && typeof state === "object" && "filePath" in state) {
			this.activeFilePath = state.filePath as string;
			this._rebuildComponent();
		}
	}
}
export const VIEW_TYPE_DRAWING = "drawing-canvas-view";
