import { ItemView, WorkspaceLeaf } from "obsidian";
import ChatEditor from "./ChatEditor.svelte";
import type SampleNotePlugin from "../main";
import { createShadowRoot } from "../vite";

export const VIEW_TYPE_CHAT = "sample-note-chat";

export class ChatView extends ItemView {
	private component: ChatEditor | null = null;
	private plugin: SampleNotePlugin;
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
		return VIEW_TYPE_CHAT;
	}

	getDisplayText(): string {
		return "Chat Assistant";
	}

	getIcon(): string {
		return "message-square";
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
		if (this.component) {
			setTimeout(() => {
				this.onResize();

				this.ensureActiveFileLoaded();
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
			targetEl.addClass("chat-editor-view");

			this.shadowRoot = createShadowRoot(targetEl);

			const componentContainer = document.createElement("div");
			componentContainer.style.width = "100%";
			componentContainer.style.height = "100%";
			componentContainer.style.display = "flex";
			componentContainer.style.flexDirection = "column";

			this.shadowRoot.appendChild(componentContainer);

			this.component = new ChatEditor({
				target: componentContainer,
				props: {
					plugin: this.plugin,
				},
			});

			setTimeout(() => {
				this.ensureActiveFileLoaded();
			}, 100);
		}

		this.isViewActive =
			this.leaf.view === this.app.workspace.getActiveViewOfType(ItemView);
	}

	async onClose(): Promise<void> {
		this.cleanupComponent();
		this.isViewActive = false;
		this.shadowRoot = null;
	}

	private cleanupComponent(): void {
		if (this.component) {
			try {
				this.component.$destroy();
			} catch (e) {
				console.error("Error destroying chat editor component:", e);
			}
			this.component = null;
		}
	}

	onResize(): void {
		window.dispatchEvent(new Event("resize"));
	}

	public notifySettingsChange(): void {
		if (this.component) {
			this.component.$set({
				plugin: this.plugin,
			});
		}
	}

	private ensureActiveFileLoaded(): void {
		if (this.component) {
			this.component.$set({
				plugin: this.plugin,
			});
		}
	}
}
