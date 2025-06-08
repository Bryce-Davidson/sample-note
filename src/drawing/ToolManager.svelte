<script lang="ts">
	import { createEventDispatcher, onMount } from "svelte";
	import { writable, derived, get } from "svelte/store";
	import type { ICanvas, ToolSize } from "./Canvas";
	import { ToolType, SizeType } from "./Canvas";
	import {
		DefaultBrush,
		EraserBrush,
		HighlighterBrush,
		PerfectFreehandBrush,
		SelectionBrush,
	} from "./Tools";

	import type { IBrush } from "./Tools";
	import type * as fabric from "fabric";
	import { BRUSH_SIZES } from "./Tools";

	export let canvas: ICanvas;
	export let defaultSize: ToolSize;
	export let defaultBackgroundColor: string = "#ffffff";

	const tools = [
		{
			type: ToolType.DefaultBrush,
			title: "Pen Tool - Draw precise lines",
			icon: `<path d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"/>`,
		},
		{
			type: ToolType.PerfectFreehand,
			title: "Perfect Freehand - Smooth natural drawing",
			icon: `<path d="M339.3 367.1c27.3-3.9 51.9-19.4 67.2-42.9L568.2 74.1c12.6-19.5 9.4-45.3-7.6-61.2S517.7-4.4 499.1 9.6L262.4 187.2c-24 18-38.2 46.1-38.4 76.1L339.3 367.1zm-19.6 25.4l-116-104.4C143.9 290.3 96 339.6 96 400c0 3.9 .2 7.8 .6 11.6C98.4 429.1 86.4 448 68.8 448L64 448c-17.7 0-32 14.3-32 32s14.3 32 32 32l144 0c61.9 0 112-50.1 112-112c0-2.5-.1-5-.2-7.5z"/>`,
		},
		{
			type: ToolType.Eraser,
			title: "Eraser Tool - Erase parts of your drawing",
			icon: `<path d="M290.7 57.4L57.4 290.7c-25 25-25 65.5 0 90.5l80 80c12 12 28.3 18.7 45.3 18.7L288 480l9.4 0L512 480c17.7 0 32-14.3 32-32s-14.3-32-32-32l-124.1 0L518.6 285.3c25-25 25-65.5 0-90.5L381.3 57.4c-25-25-65.5-25-90.5 0zM297.4 416l-9.4 0-105.4 0-80-80L227.3 211.3 364.7 348.7 297.4 416z"/>`,
		},
		{
			type: ToolType.Highlighter,
			title: "Highlighter Tool - Highlight with transparency",
			icon: `<path d="M315 315l158.4-215L444.1 70.6 229 229 315 315zm-187 5s0 0 0 0l0-71.7c0-15.3 7.2-29.6 19.5-38.6L420.6 8.4C428 2.9 437 0 446.2 0c11.4 0 22.4 4.5 30.5 12.6l54.8 54.8c8.1 8.1 12.6 19 12.6 30.5c0 9.2-2.9 18.2-8.4 25.6L334.4 396.5c-9 12.3-23.4 19.5-38.6 19.5L224 416l-25.4 25.4c-12.5 12.5-32.8 12.5-45.3 0l-50.7-50.7c-12.5-12.5-12.5-32.8 0-45.3L128 320zM7 466.3l63-63 70.6 70.6-31 31c-4.5 4.5-10.6 7-17 7L24 512c-13.3 0-24-10.7-24-24l0-4.7c0-6.4 2.5-12.5 7-17z"/>`,
		},
		{
			type: ToolType.SelectionBrush,
			title: "Selection Brush - Draw to select objects",
			icon: `<path d="M14.1 463.3c-18.7-18.7-18.7-49.1 0-67.9L395.4 14.1c18.7-18.7 49.1-18.7 67.9 0l34.6 34.6c18.7 18.7 18.7 49.1 0 67.9L116.5 497.9c-18.7 18.7-49.1 18.7-67.9 0L14.1 463.3zM347.6 187.6l105-105L429.4 59.3l-105 105 23.3 23.3z"/>`,
		},
	];

	const dispatch = createEventDispatcher<{
		sizeChange: { size: ToolSize };
		colorChange: { color: string };
		backgroundChange: { color: string };
		canvas_interaction: { timestamp: number };
		selectionChange: {
			selection: fabric.Object | fabric.ActiveSelection | null;
		};
	}>();

	const activeTool = writable<ToolType>(ToolType.DefaultBrush);
	const activeSize = writable<ToolSize>(defaultSize);
	const activeColor = writable<string>("#000000");
	const previousTool = writable<ToolType>(ToolType.DefaultBrush);
	const toolDisposers = writable<(() => void)[]>([]);
	const backgroundColor = writable<string>(defaultBackgroundColor);
	const activeSelection = writable<
		fabric.Object | fabric.ActiveSelection | null
	>(null);
	const stylusOnlyMode = writable<boolean>(false);

	type ToolRule = {
		allowStrokeWidthChange: boolean;
		allowColorChange: boolean;
		defaultColor?: string;
		supportsSelection?: boolean;
	};

	const toolRules: Map<ToolType, ToolRule> = new Map([
		[
			ToolType.DefaultBrush,
			{
				allowStrokeWidthChange: true,
				allowColorChange: true,
				supportsSelection: false,
			},
		],
		[
			ToolType.PerfectFreehand,
			{
				allowStrokeWidthChange: true,
				allowColorChange: true,
				supportsSelection: false,
			},
		],
		[
			ToolType.Eraser,
			{
				allowStrokeWidthChange: true,
				allowColorChange: false,
				supportsSelection: false,
			},
		],
		[
			ToolType.Highlighter,
			{
				allowStrokeWidthChange: true,
				allowColorChange: true,
				defaultColor: "rgba(255, 255, 0, 0.3)",
				globalCompositeOperation: "multiply",
				supportsSelection: false,
			},
		],
		[
			ToolType.SelectionBrush,
			{
				allowStrokeWidthChange: false,
				allowColorChange: false,
				supportsSelection: true,
			},
		],
		[
			ToolType.Pan,
			{
				allowStrokeWidthChange: false,
				allowColorChange: false,
				supportsSelection: false,
			},
		],
	]);

	const allowColorChange = derived(activeTool, ($activeTool) => {
		const toolRule = toolRules.get($activeTool);
		return toolRule ? toolRule.allowColorChange : false;
	});

	const allowSizeChange = derived(activeTool, ($activeTool) => {
		const toolRule = toolRules.get($activeTool);
		return toolRule ? toolRule.allowStrokeWidthChange : false;
	});

	const sizes: ToolSize[] = [
		{
			name: SizeType.Small,
			width: BRUSH_SIZES.SMALL.width,
			title: BRUSH_SIZES.SMALL.title,
		},
		{
			name: SizeType.Medium,
			width: BRUSH_SIZES.MEDIUM.width,
			title: BRUSH_SIZES.MEDIUM.title,
		},
		{
			name: SizeType.Large,
			width: BRUSH_SIZES.LARGE.width,
			title: BRUSH_SIZES.LARGE.title,
		},
	];

	const defaultColors = [
		{ value: "#000000", name: "Black" },
		{ value: "#ff0000", name: "Red" },
		{ value: "#0000ff", name: "Blue" },
	];

	function getFabricCanvas() {
		if (!canvas) return null;
		try {
			return canvas;
		} catch (e) {
			console.warn("Error accessing fabric canvas:", e);
			return null;
		}
	}

	onMount(() => {
		setActiveTool(ToolType.DefaultBrush);

		canvas.backgroundColor = get(backgroundColor);

		return () => {
			const currentDisposers = get(toolDisposers);
			currentDisposers.forEach((disposer) => disposer());
			toolDisposers.set([]);
		};
	});

	$: if ($backgroundColor) {
		applyBackgroundColor();
	}

	$: if (
		defaultBackgroundColor &&
		defaultBackgroundColor !== $backgroundColor
	) {
		backgroundColor.set(defaultBackgroundColor);
	}

	$: if ($activeTool) {
		configureCanvasForTool($activeTool);
	}

	function deleteSelection() {
		const activeObjects = canvas.getActiveObjects();

		canvas.asBatchedOperation((canvas) => {
			if (activeObjects.length) {
				activeObjects.forEach((obj) => canvas.remove(obj));
			} else if ($activeSelection) {
				canvas.remove($activeSelection);
			}

			canvas.discardActiveObject();
			activeSelection.set(null);
			canvas.renderAll();
		});

		dispatch("canvas_interaction", {
			timestamp: Date.now(),
		});
	}

	function applyBackgroundColor() {
		canvas.withPausedHistory(() => {
			canvas.backgroundColor = get(backgroundColor);
			canvas.renderAll();
		});
	}

	function setActiveTool(toolType: ToolType): void {
		if (get(activeTool) === toolType) return;

		if (get(activeTool) !== ToolType.Pan) {
			previousTool.set(get(activeTool));
		}

		activeTool.set(toolType);
		configureCanvasForTool(toolType);
		canvas.renderAll();
	}

	function setActiveSize(size: ToolSize): void {
		const toolRule = toolRules.get(get(activeTool));
		if (!toolRule || !toolRule.allowStrokeWidthChange) return;

		activeSize.set(size);

		const brush = canvas.freeDrawingBrush as unknown as IBrush;
		if (!brush) return;
		brush.setWidth(get(activeSize).width);

		dispatch("sizeChange", { size });
	}

	function setColor(color: string): void {
		const toolRule = toolRules.get(get(activeTool));
		if (!toolRule || !toolRule.allowColorChange) return;

		activeColor.set(color);

		const brush = canvas.freeDrawingBrush as unknown as IBrush;
		if (brush && brush.setColor) {
			brush.setColor(color);
		}

		dispatch("colorChange", { color });
	}

	function configureCanvasForTool(toolType: ToolType): void {
		const fabricCanvas = getFabricCanvas();
		if (!fabricCanvas) return;

		const currentDisposers = get(toolDisposers);
		currentDisposers.forEach((disposer) => disposer());
		toolDisposers.set([]);

		canvas.discardActiveObject();
		activeSelection.set(null);

		switch (toolType) {
			case ToolType.DefaultBrush:
				canvas.isDrawingMode = true;
				canvas.freeDrawingBrush = new DefaultBrush(
					fabricCanvas,
					get(activeColor),
					get(activeSize).width,
				);
				break;
			case ToolType.PerfectFreehand:
				canvas.isDrawingMode = true;
				canvas.freeDrawingBrush = new PerfectFreehandBrush(
					fabricCanvas,
					get(activeColor),
					get(activeSize).width,
				);
				break;
			case ToolType.Eraser:
				canvas.isDrawingMode = true;
				canvas.freeDrawingBrush = new EraserBrush(
					fabricCanvas,
					get(activeSize).width,
				);
				break;
			case ToolType.Highlighter:
				canvas.isDrawingMode = true;
				canvas.freeDrawingBrush = new HighlighterBrush(fabricCanvas);
				break;
			case ToolType.SelectionBrush:
				canvas.isDrawingMode = true;
				canvas.selection = true;

				canvas.getObjects().forEach((obj) => {
					obj.set({
						selectable: true,
						hasControls: true,
					});
				});

				canvas.skipTargetFind = false;
				canvas.defaultCursor = "crosshair";
				canvas.hoverCursor = "crosshair";

				canvas.freeDrawingBrush = new SelectionBrush(fabricCanvas);

				toolDisposers.set([
					canvas.on("selection:created", () => {
						canvas.isDrawingMode = false;
						canvas.defaultCursor = "default";
						canvas.hoverCursor = "move";
					}),
					canvas.on("selection:cleared", () => {
						if (get(activeTool) === ToolType.SelectionBrush) {
							canvas.isDrawingMode = true;
							canvas.defaultCursor = "crosshair";
							canvas.hoverCursor = "crosshair";
						}
					}),
				]);
				break;
			case ToolType.Pan:
				canvas.isDrawingMode = false;
				canvas.selection = false;

				canvas.getObjects().forEach((obj) => {
					obj.set({
						selectable: false,
						hasControls: false,
					});
				});

				canvas.skipTargetFind = true;
				canvas.defaultCursor = "grab";
				canvas.hoverCursor = "grab";

				const pointerDown = (opt: any) => {
					canvas.defaultCursor = "grabbing";
					canvas.hoverCursor = "grabbing";
				};

				const pointerMove = (opt: any) => {
					if (canvas.defaultCursor !== "grabbing") return;

					const vpt = canvas.viewportTransform;
					if (!vpt) return;

					const e = opt.e;
					const deltaX = e.movementX;
					const deltaY = e.movementY;

					canvas.setViewportTransform([
						vpt[0],
						vpt[1],
						vpt[2],
						vpt[3],
						vpt[4] + deltaX,
						vpt[5] + deltaY,
					]);

					canvas.renderAll();
				};

				const pointerUp = () => {
					canvas.defaultCursor = "grab";
					canvas.hoverCursor = "grab";
				};

				toolDisposers.set([
					canvas.on("mouse:down", pointerDown),
					canvas.on("mouse:move", pointerMove),
					canvas.on("mouse:up", pointerUp),
				]);
				break;

			default:
				canvas.freeDrawingBrush = new DefaultBrush(
					fabricCanvas,
					get(activeColor),
					get(activeSize).width,
				);
		}
	}

	function togglePan(): void {
		if (get(activeTool) === ToolType.Pan) {
			setActiveTool(get(previousTool));
		} else {
			previousTool.set(get(activeTool));
			setActiveTool(ToolType.Pan);
		}
	}

	function toggleStylusOnlyMode(): void {
		const isEnabled = get(stylusOnlyMode);

		if (isEnabled) {
			canvas.disableStylusOnlyMode();
			stylusOnlyMode.set(false);
		} else {
			canvas.enableStylusOnlyMode();
			stylusOnlyMode.set(true);
		}
	}
</script>

<div class="tool-manager-container sample-note-reset">
	<div class="tool-manager-wrapper">
		<div class="tool-buttons-group">
			{#each tools as tool}
				<button
					class="tool-button {$activeTool === tool.type
						? 'tool-button-active'
						: ''}"
					on:click={() => setActiveTool(tool.type)}
					aria-label={tool.title}
					aria-pressed={$activeTool === tool.type}
					type="button"
					title={tool.title}
					data-tool={tool.type}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 576 512"
						class="tool-icon"
						fill="currentColor"
						aria-hidden="true"
						focusable="false"
					>
						{@html tool.icon}
					</svg>
				</button>
			{/each}
		</div>

		<div
			class="size-controls-group"
			role="group"
			aria-label="Brush size controls"
		>
			{#each sizes as size}
				<button
					class="size-button {$activeSize.name === size.name
						? 'size-button-active'
						: ''} {!$allowSizeChange ? 'disabled' : ''}"
					on:click={() => setActiveSize(size)}
					disabled={!$allowSizeChange}
					aria-label={size.title}
					aria-pressed={$activeSize.name === size.name}
					type="button"
					title={size.title}
				>
					<div
						class="size-indicator"
						style="width: {size.width}px; height: {size.width}px;"
					></div>
				</button>
			{/each}
		</div>

		<div
			class="color-controls-group {!$allowColorChange ? 'disabled' : ''}"
			role="region"
			aria-label="Color selection"
		>
			<div class="default-colors-group">
				{#each defaultColors as color}
					<button
						class="color-button {$activeColor === color.value
							? 'color-button-active'
							: ''}"
						style="background-color: {color.value};"
						on:click={() => setColor(color.value)}
						disabled={!$allowColorChange}
						title={color.name}
						aria-label={color.name}
						aria-pressed={$activeColor === color.value}
						type="button"
					></button>
				{/each}
			</div>

			<button
				class="custom-color-button {$activeColor !==
					defaultColors[0].value &&
				$activeColor !== defaultColors[1].value &&
				$activeColor !== defaultColors[2].value
					? 'custom-color-active'
					: ''}"
				style="background-color: {$activeColor};"
				type="button"
				aria-label="Select custom color"
			>
				<input
					type="color"
					bind:value={$activeColor}
					on:change={() => setColor($activeColor)}
					disabled={!$allowColorChange}
					class="color-input"
					aria-label="Select custom color"
				/>
			</button>
		</div>

		<!-- Tool Buttons -->
		<div class="utility-buttons-group">
			<!-- Pan Tool Button -->
			<button
				class="tool-button {$activeTool === ToolType.Pan
					? 'tool-button-active'
					: ''}"
				on:click={() => togglePan()}
				aria-label="Pan Tool"
				aria-pressed={$activeTool === ToolType.Pan}
				type="button"
				title="Pan Tool (Hold spacebar for temporary pan)"
				data-tool={ToolType.Pan}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 512 512"
					class="tool-icon"
					fill="currentColor"
					aria-hidden="true"
					focusable="false"
				>
					<path
						d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 208c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-176c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 272c0 1.5 0 3.1 .1 4.6L67.6 283c-16-15.2-41.3-14.6-56.6 1.4s-14.6 41.3 1.4 56.6L124.8 448c43.1 41.1 100.4 64 160 64l19.2 0c97.2 0 176-78.8 176-176l0-208c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 112c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-176c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 176c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-208z"
					/>
				</svg>
			</button>

			<!-- Stylus-Only Mode Button -->
			<button
				class="tool-button {$stylusOnlyMode
					? 'tool-button-active'
					: ''}"
				on:click={toggleStylusOnlyMode}
				aria-label="Stylus-Only Mode"
				aria-pressed={$stylusOnlyMode}
				type="button"
				title="Stylus-Only Mode - Ignore finger/mouse input"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 512 512"
					class="tool-icon"
					fill="currentColor"
					aria-hidden="true"
					focusable="false"
				>
					<path
						d="M368.4 18.3L312.7 74.1 437.9 199.3l55.7-55.7c21.9-21.9 21.9-57.3 0-79.2L447.6 18.3c-21.9-21.9-57.3-21.9-79.2 0zM288 94.6l-9.2 2.8L134.7 140.6c-19.9 6-35.7 21.2-42.3 41L3.8 445.8c-3.8 11.3-1 23.9 7.3 32.4L164.7 324.7c-3-6.3-4.7-13.3-4.7-20.7c0-26.5 21.5-48 48-48s48 21.5 48 48s-21.5 48-48 48c-7.4 0-14.4-1.7-20.7-4.7L33.7 500.9c8.6 8.3 21.1 11.2 32.4 7.3l264.3-88.6c19.7-6.6 35-22.4 41-42.3l43.2-144.1 2.7-9.2L288 94.6z"
					/>
				</svg>
			</button>

			<!-- Delete Selection Button - Only visible when there's an active selection -->
			{#if $activeSelection}
				<button
					class="tool-button delete-button"
					on:click={deleteSelection}
					aria-label="Delete Selection"
					type="button"
					title="Delete selected object"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 448 512"
						class="tool-icon"
						fill="currentColor"
						aria-hidden="true"
						focusable="false"
					>
						<path
							d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"
						/>
					</svg>
				</button>
			{/if}
		</div>
	</div>
</div>

<style lang="postcss">
	.tool-manager-container {
		/* Reset any inherited styles */
	}

	.tool-manager-wrapper {
		@apply flex flex-wrap items-center gap-2 sm:gap-4 md:gap-6 lg:gap-10 p-1;
	}

	.tool-buttons-group {
		@apply flex flex-wrap gap-1 sm:gap-2 md:gap-4 p-0.5;
	}

	.tool-button {
		@apply p-1.5 rounded-lg flex items-center justify-center;
		@apply text-gray-500 dark:text-gray-400;
		@apply border border-transparent shadow-none;
		@apply transition-colors duration-150;
	}

	.tool-button:hover {
		@apply bg-gray-100 dark:bg-gray-700;
	}

	.tool-button-active {
		@apply text-gray-900 dark:text-white;
		@apply bg-blue-100 dark:bg-blue-900/30;
		@apply outline outline-2 outline-blue-500 outline-offset-1;
	}

	.tool-icon {
		@apply w-4 h-4;
	}

	.size-controls-group {
		@apply flex flex-wrap gap-1 sm:gap-2;
	}

	.size-button {
		@apply p-1.5 rounded-lg flex items-center justify-center;
		@apply text-gray-500 dark:text-gray-400;
		@apply border border-transparent shadow-none;
		@apply w-8 h-8;
		@apply cursor-pointer transition-colors duration-150;
	}

	.size-button:hover:not(.disabled) {
		@apply bg-gray-100 dark:bg-gray-700;
	}

	.size-button-active {
		@apply text-gray-900 dark:text-white;
		@apply bg-blue-100 dark:bg-blue-900/30;
		@apply outline outline-2 outline-blue-500 outline-offset-1;
	}

	.size-button.disabled {
		@apply opacity-50 cursor-not-allowed;
	}

	.size-indicator {
		@apply flex-shrink-0 bg-current rounded-full;
	}

	.color-controls-group {
		@apply flex flex-wrap items-center gap-1 sm:gap-2;
	}

	.color-controls-group.disabled {
		@apply opacity-50 cursor-not-allowed pointer-events-none;
	}

	.default-colors-group {
		@apply flex items-center gap-1 sm:gap-1.5 mr-1 sm:mr-2;
	}

	.color-button {
		@apply w-5 h-5 rounded-full border-0 flex items-center justify-center;
		@apply transition-all duration-150;
	}

	.color-button:hover {
		@apply scale-110;
	}

	.color-button-active {
		@apply outline outline-2 outline-blue-500 outline-offset-1;
	}

	.custom-color-button {
		@apply relative w-5 h-5 rounded-full border-0;
		@apply flex items-center justify-center cursor-pointer;
		@apply transition-all duration-150;
	}

	.custom-color-button:hover {
		@apply scale-110;
	}

	.custom-color-active {
		@apply outline outline-2 outline-blue-500 outline-offset-1;
	}

	.color-input {
		@apply absolute inset-0 z-10 w-full h-full opacity-0;
		cursor: pointer !important;
	}

	.utility-buttons-group {
		@apply flex flex-wrap items-center gap-1 sm:gap-2;
	}

	.delete-button {
		@apply text-gray-500 dark:text-gray-400;
		@apply bg-transparent;
		@apply outline-none;
	}

	.delete-button:hover {
		@apply text-red-500 dark:text-red-400;
		@apply bg-red-50 dark:bg-red-900/20;
	}
</style>
