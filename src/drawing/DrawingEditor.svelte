<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from "svelte";
	import { writable } from "svelte/store";
	import type { App } from "obsidian";
	import { Notice, TFile } from "obsidian";

	import { ICanvas, ToolType, SizeType, type ToolSize } from "./Canvas";

	import ToolManager from "./ToolManager.svelte";

	import { BRUSH_SIZES } from "./Tools";

	export let app: App;
	export let plugin: any;
	export let filePath: string;
	export let openInSidebar: () => void;
	export let openInMainArea: () => void;
	export let isInSidebar: () => boolean;
	export let closeSidebar: () => void;

	const drawingState = writable({
		tool: ToolType.DefaultBrush,
		size: null as ToolSize | null,
		color: "#000000",
		backgroundColor: "#ffffff",
	});

	const dispatch = createEventDispatcher<{
		drawing_saved: { filePath: string; timestamp: number; manual: boolean };
		drawing_loaded: { filePath: string; timestamp: number };
		canvas_interaction: { timestamp: number };
		component_mounted: { timestamp: number };
		component_destroyed: { timestamp: number };
	}>();

	let canvasContainer: HTMLDivElement;
	let bgColorInput: HTMLInputElement;
	let editControlsGroup: HTMLDivElement;

	let canvas: ICanvas;
	let toolManagerRef: any;

	let isBeingUpdatedExternally = false;
	let lastInteractionTime = 0;
	let resizeObserver: ResizeObserver | null = null;

	let eventHandlers: Array<{
		element: HTMLElement;
		event: string;
		handler: EventListener;
	}> = [];
	let storedBackgroundColor: string | null = null;

	let autoSaveTimeoutId: number | null = null;
	const AUTO_SAVE_DELAY = 2000;

	// Reactive variable for background color preview
	let bgColorPreviewColor = "#ffffff";

	const defaultSize: ToolSize = {
		name: SizeType.Small,
		width: BRUSH_SIZES.SMALL.width,
		title: BRUSH_SIZES.SMALL.title,
	};

	const editControls = [
		{
			path: `M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15`,
			title: "Reset to Saved View",
			action: () => canvas?.resetView(),
		},
		{
			path: `M3 10h10a8 8 0 018 8v2M3 10l6-6M3 10l6 6`,
			title: "Undo last action",
			action: () => {
				if (canvas) {
					canvas.undo();
					handleCanvasInteraction();
				}
			},
		},
		{
			path: `M21 10H11a8 8 0 00-8 8v2M21 10l-6-6M21 10l-6 6`,
			title: "Redo last action",
			action: () => {
				if (canvas) {
					canvas.redo();
					handleCanvasInteraction();
				}
			},
		},
		{
			path: `M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10`,
			title: "Set Current View as Default",
			action: () => {
				if (canvas) {
					canvas.saveCurrentViewAsDefault();
					saveCurrentViewState();
					new Notice("View position saved as default");
				}
			},
		},
	];

	const saveButton = {
		path: `M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z M17 21v-8H7v8 M7 3v5h8`,
		title: "Save Drawing (Click to save manually)",
	};

	const clearButton = {
		path: `M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16`,
		title: "Clear canvas",
		action: () => {
			if (confirm("Are you sure you want to clear the canvas?")) {
				if (canvas) {
					try {
						canvas.clear();
						handleCanvasInteraction();
					} catch (e) {
						console.error("Error clearing canvas:", e);
						new Notice(
							"Failed to clear canvas - try reloading the view",
						);
					}
				}
			}
		},
	};

	const openInSidebarButton = {
		path: `M334.5 414c8.8 3.8 19 2 26-4.6l144-136c4.8-4.5 7.5-10.8 7.5-17.4s-2.7-12.9-7.5-17.4l-144-136c-7-6.6-17.2-8.4-26-4.6s-14.5 12.5-14.5 22l0 72L32 192c-17.7 0-32 14.3-32 32l0 64c0 17.7 14.3 32 32 32l288 0 0 72c0 9.6 5.7 18.2 14.5 22z`,
		title: "Open in Sidebar and Close",
		action: () => openInSidebar(),
	};

	const openInMainAreaButton = {
		path: `M177.5 414c-8.8 3.8-19 2-26-4.6l-144-136C2.7 268.9 0 262.6 0 256s2.7-12.9 7.5-17.4l144-136c7-6.6 17.2-8.4 26-4.6s14.5 12.5 14.5 22l0 72 288 0c17.7 0 32 14.3 32 32l0 64c0 17.7-14.3 32-32 32l-288 0 0 72c0 9.6-5.7 18.2-14.5 22z`,
		title: "Open in Main Area and Close",
		action: () => {
			openInMainArea();
			closeSidebar();
		},
	};

	onMount(() => {
		if (!canvasContainer) {
			console.error(
				"[DrawingEditor] onMount - canvasContainer is not available!",
			);
			return;
		}

		canvas = new ICanvas(app, {
			container: canvasContainer,
			width: canvasContainer.clientWidth,
			height: canvasContainer.clientHeight,
		});

		if (filePath) {
			loadDrawing(filePath);
		}

		resizeObserver = new ResizeObserver(() => {
			const rect = canvasContainer.getBoundingClientRect();
			canvas.resize(Math.floor(rect.width), Math.floor(rect.height));
		});
		resizeObserver.observe(canvasContainer);
		setupBackgroundColorPicker();

		const unregisterFileOpen = plugin.app.workspace.on(
			"file-open",
			async (file: TFile) => {
				if (file && file instanceof TFile) {
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

		const unregisterFileRename = plugin.app.vault.on(
			"rename",
			(file: TFile, oldPath: string) => {
				if (filePath === oldPath) {
					filePath = file.path;
					loadDrawing(filePath);
				}
			},
		);

		dispatch("component_mounted", { timestamp: Date.now() });

		return () => {
			if (resizeObserver) {
				resizeObserver.disconnect();
				resizeObserver = null;
			}

			eventHandlers.forEach(({ element, event, handler }) => {
				element.removeEventListener(event, handler);
			});
			eventHandlers = [];

			if (autoSaveTimeoutId !== null) {
				window.clearTimeout(autoSaveTimeoutId);
			}

			persistDrawingToPlugin(filePath);

			canvas.dispose();

			plugin.app.workspace.offref(unregisterFileOpen);
			plugin.app.vault.offref(unregisterFileRename);
		};
	});

	onDestroy(() => {
		if (resizeObserver) {
			resizeObserver.disconnect();
			resizeObserver = null;
		}

		eventHandlers.forEach(({ element, event, handler }) => {
			element.removeEventListener(event, handler);
		});
		eventHandlers = [];

		if (autoSaveTimeoutId !== null) {
			window.clearTimeout(autoSaveTimeoutId);
		}

		persistDrawingToPlugin(filePath);

		canvas.dispose();
	});

	function handleToolChange(
		event: CustomEvent<{ tool: ToolType; previous: ToolType }>,
	) {
		const { tool } = event.detail;
		drawingState.update((state) => ({ ...state, tool }));
	}

	function handleSizeChange(event: CustomEvent<{ size: ToolSize }>) {
		const { size } = event.detail;
		drawingState.update((state) => ({ ...state, size }));
	}

	function handleColorChange(event: CustomEvent<{ color: string }>) {
		const { color } = event.detail;
		drawingState.update((state) => ({ ...state, color }));
	}

	function handleBackgroundChange(event: CustomEvent<{ color: string }>) {
		const { color } = event.detail;
		drawingState.update((state) => ({ ...state, backgroundColor: color }));

		bgColorPreviewColor = color;
		if (bgColorInput) {
			bgColorInput.value = color;
		}
		if (canvas) {
			canvas.backgroundColor = color;
		}
		handleCanvasInteraction();
	}

	function handleComponentMounted(event: CustomEvent<{ timestamp: number }>) {
		dispatch("component_mounted", event.detail);
	}

	function handleComponentDestroyed(
		event: CustomEvent<{ timestamp: number }>,
	) {
		dispatch("component_destroyed", event.detail);
	}

	function setupBackgroundColorPicker() {
		if (!bgColorInput) return;

		bgColorPreviewColor = "#ffffff";

		const colorChangeHandler = (e: Event) => {
			const target = e.target as HTMLInputElement;
			const color = target.value;
			if (isBeingUpdatedExternally) return;
			bgColorPreviewColor = color;
			if (canvas) {
				canvas.backgroundColor = color;
			}
			handleCanvasInteraction();
		};

		bgColorInput.addEventListener("change", colorChangeHandler);
		eventHandlers.push({
			element: bgColorInput,
			event: "change",
			handler: colorChangeHandler,
		});
	}

	function loadDrawing(path: string) {
		if (!plugin || !canvas || !path) return;

		const drawingData = plugin?.notes?.[path]?.data?.drawing;
		if (!drawingData || !drawingData.json) {
			console.log(
				`No drawing data found for ${path} or JSON is missing.`,
			);
			return;
		}

		canvas.loadFromJSON(drawingData.json);

		if (drawingData.viewState?.backgroundColor) {
			const bgColor = drawingData.viewState.backgroundColor;
			bgColorPreviewColor = bgColor;
			if (bgColorInput) {
				bgColorInput.value = bgColor;
			}
			drawingState.update((state) => ({
				...state,
				backgroundColor: bgColor,
			}));
		}

		dispatch("drawing_loaded", { filePath: path, timestamp: Date.now() });
	}

	function persistDrawingToPlugin(path: string) {
		if (!plugin || !canvas || !path) return;
		const json = canvas.getJSON();
		if (!json || json === "" || json === "{}") {
			console.log("Skipping persistence of empty or default drawing.");
			return;
		}

		if (!plugin.notes[path]) {
			plugin.notes[path] = { cards: {}, data: { noteVisitLog: [] } };
		}

		if (!plugin.notes[path].data) {
			plugin.notes[path].data = { noteVisitLog: [] };
		}

		plugin.notes[path].data.drawing = {
			json,
			viewState: canvas.getViewState(),
		};

		plugin.saveData({
			settings: plugin.settings,
			notes: plugin.notes,
		});
	}

	function saveCurrentDrawing() {
		persistDrawingToPlugin(filePath);

		new Notice("Drawing saved successfully");

		dispatch("drawing_saved", {
			filePath: filePath,
			timestamp: Date.now(),
			manual: true,
		});
	}

	function saveCurrentViewState() {
		persistDrawingToPlugin(filePath);
	}

	function handleCanvasInteraction() {
		if (isBeingUpdatedExternally) return;

		lastInteractionTime = Date.now();

		if (autoSaveTimeoutId !== null) {
			window.clearTimeout(autoSaveTimeoutId);
		}

		autoSaveTimeoutId = window.setTimeout(() => {
			persistDrawingToPlugin(filePath);
			dispatch("drawing_saved", {
				filePath: filePath,
				timestamp: Date.now(),
				manual: false,
			});
		}, AUTO_SAVE_DELAY);

		dispatch("canvas_interaction", {
			timestamp: lastInteractionTime,
		});
	}
</script>

<div class="root">
	<!-- Toolbar with improved responsive design - Single row with logical groups -->
	<div class="toolbar">
		<!-- Group 1: Drawing Tools - Most important and frequently used -->
		<div class="tool-group">
			{#if canvas}
				<ToolManager
					bind:this={toolManagerRef}
					{canvas}
					{defaultSize}
					defaultBackgroundColor={storedBackgroundColor || "#ffffff"}
					on:toolChange={handleToolChange}
					on:sizeChange={handleSizeChange}
					on:colorChange={handleColorChange}
					on:backgroundChange={handleBackgroundChange}
					on:componentMounted={handleComponentMounted}
					on:componentDestroyed={handleComponentDestroyed}
				/>
			{/if}
		</div>

		<!-- Group 2: Background Color -->
		<div class="background-color-group">
			<div class="color-picker-button" title="Change Background Color">
				<div
					class="color-preview"
					style:background-color={bgColorPreviewColor}
				></div>
				<input
					type="color"
					class="color-input"
					value="#ffffff"
					bind:this={bgColorInput}
				/>
			</div>
		</div>

		<!-- Group 3: Edit Controls -->
		<div class="edit-controls-group" bind:this={editControlsGroup}>
			<!-- Save Button -->
			<button
				type="button"
				class="toolbar-button"
				title={saveButton.title}
				on:click={saveCurrentDrawing}
				data-plugin="sample-note"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					class="toolbar-icon"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
					focusable="false"
				>
					<path d={saveButton.path} />
				</svg>
			</button>

			<!-- Edit Controls -->
			{#each editControls as control}
				<button
					type="button"
					class="toolbar-button"
					title={control.title}
					on:click={control.action}
					data-plugin="sample-note"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						class="toolbar-icon"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
						focusable="false"
					>
						<path d={control.path} />
					</svg>
				</button>
			{/each}
		</div>

		<!-- Group 4: Layout/View Controls -->
		<div class="layout-controls-group">
			<!-- Toggle button for sidebar/main area -->
			<button
				type="button"
				class="toolbar-button"
				title={isInSidebar() ? "Open in Main Area" : "Open in Sidebar"}
				on:click={() =>
					isInSidebar()
						? (openInMainArea(), closeSidebar && closeSidebar())
						: openInSidebar()}
				data-plugin="sample-note"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 512 512"
					class="toolbar-icon"
					fill="currentColor"
					aria-hidden="true"
					focusable="false"
				>
					{#if isInSidebar()}
						<path d={openInMainAreaButton.path} />
					{:else}
						<path d={openInSidebarButton.path} />
					{/if}
				</svg>
			</button>
		</div>

		<!-- Group 5: Destructive Actions -->
		<div class="destructive-actions-group">
			<!-- Clear Button -->
			<button
				type="button"
				class="toolbar-button clear-button"
				title={clearButton.title}
				on:click={clearButton.action}
				data-plugin="sample-note"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					class="toolbar-icon"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
					focusable="false"
				>
					<path d={clearButton.path} />
				</svg>
			</button>
		</div>
	</div>

	<div class="canvas-container" bind:this={canvasContainer}></div>
</div>

<style lang="postcss">
	.root {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
	}

	.toolbar {
		@apply flex flex-wrap items-center gap-3 px-3 py-2;
		@apply border-b border-gray-200 dark:border-gray-700;
		@apply bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm;
	}

	.tool-group {
		@apply flex flex-wrap items-center gap-2 p-0.5 sm:p-1;
	}

	.background-color-group {
		@apply flex items-center p-0.5 sm:p-1 ml-auto sm:ml-0;
	}

	.color-picker-button {
		@apply p-1.5 rounded-lg flex items-center justify-center;
		@apply text-gray-500 dark:text-gray-400;
		@apply border border-transparent shadow-none bg-transparent;
		@apply relative;
	}

	.color-preview {
		@apply w-5 h-5 border border-gray-300 dark:border-gray-600 rounded;
	}

	.color-input {
		@apply absolute inset-0 w-full h-full opacity-0 cursor-pointer;
	}

	.edit-controls-group {
		@apply flex flex-wrap items-center gap-1 p-0.5 sm:p-1;
		@apply border-l border-gray-200 dark:border-gray-700 pl-2 sm:pl-3;
	}

	.layout-controls-group {
		@apply flex items-center p-0.5 sm:p-1;
		@apply border-l border-gray-200 dark:border-gray-700 pl-2 sm:pl-3;
	}

	.destructive-actions-group {
		@apply flex items-center p-0.5 sm:p-1;
		@apply border-l border-gray-200 dark:border-gray-700 pl-2 sm:pl-3;
	}

	.toolbar-button {
		@apply p-1.5 rounded-lg flex items-center justify-center;
		@apply text-gray-500 dark:text-gray-400;
		@apply border border-transparent shadow-none bg-transparent;
		@apply transition-colors duration-150;
	}

	.toolbar-button:hover {
		@apply bg-gray-100 dark:bg-gray-700;
	}

	.toolbar-button.clear-button {
		@apply text-red-500 dark:text-red-400;
	}

	.toolbar-icon {
		@apply w-4 h-4;
	}

	.canvas-container {
		flex: 1;
		position: relative;
		overflow: hidden;
		outline: none;
		-webkit-user-select: none;
		user-select: none;
		-webkit-touch-callout: none;
	}

	/* Override Obsidian's button tray styling */
	:global(.is-tablet .workspace-tab-header-container-inner),
	:global(.workspace-tab-container-inner),
	:global(.workspace-tab-header-container-inner) {
		box-shadow: none !important;
		outline: none !important;
		border: none !important;
	}

	:global(.workspace-split > .workspace-leaf) {
		box-shadow: none !important;
		outline: none !important;
	}
</style>
