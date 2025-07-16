<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import Konva from "konva";
	import { TFile, MarkdownView, Notice } from "obsidian";
	import Fuse from "fuse.js";
	import { createFlashcardModal } from "../flashcard/FlashcardManager";
	import { generateUUID } from "../main";
	import type { CardState } from "../types";
	import { flashcardEventStore } from "../flashcard/FlashcardEventStore";
	import FlashcardInfoPanel from "./components/FlashcardInfoPanel.svelte";
	import FlashcardCreationButtons from "./components/FlashcardCreationButtons.svelte";
	import ToolsRow from "./components/ToolsRow.svelte";
	import EditorControls from "./components/EditorControls.svelte";
	import FileSelection from "./components/FileSelection.svelte";
	import TagManager from "./components/TagManager.svelte";

	export let plugin: any;
	export let selectedFilePath = "";

	let containerEl: HTMLElement;
	let konvaContainer: HTMLDivElement;
	let stage: Konva.Stage;
	let imageLayer: Konva.Layer;
	let shapeLayer: Konva.Layer;
	let transformer: Konva.Transformer;
	let selectedRect: Konva.Rect | null = null;
	let selectedRects: Konva.Rect[] = [];

	let isCanvasFocused = false;
	let isSpacePressed = false;
	let isPanning = false;
	let lastPointerPosition = { x: 0, y: 0 };

	let clickAndDragOcclusionMode = false;
	let tempRect: Konva.Rect | null = null;
	let startPoint: { x: number; y: number } | null = null;

	let colorValue = "#000000";
	let hasUnsavedChanges = false;
	let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

	let resizeObserverInstance: ResizeObserver | null = null;
	let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

	let copiedRects: OcclusionShape[] = [];

	type OcclusionShape = {
		x: number;
		y: number;
		width: number;
		height: number;
		fill: string;
		opacity: number;
		id?: string;
	};

	let selectedOcclusioncards: CardState[] = [];
	let flashcardInfoVisible = false;

	// Tag management
	let imageTags: string[] = [];
	let allAvailableTags: Set<string> = new Set();

	interface CardStatusStyles {
		liClass: string;
		dotClass: string;
		textClass: string;
		statsTextClass: string;
	}

	function getCardStatusStyles(
		nextReviewDateStr: string | null | undefined,
	): CardStatusStyles {
		const baseLiClasses =
			"flex items-center justify-between p-1.5 text-xs rounded bg-gray-100 dark:bg-gray-700";

		let styles: CardStatusStyles = {
			liClass: baseLiClasses,
			dotClass: "bg-gray-400 dark:bg-gray-500",
			textClass: "text-gray-800 dark:text-gray-200",
			statsTextClass: "text-gray-500 dark:text-gray-400",
		};

		if (!nextReviewDateStr) {
			return styles;
		}

		const nextReviewDate = new Date(nextReviewDateStr);
		const now = new Date();

		const twoDaysFromNow = new Date(now);
		twoDaysFromNow.setDate(now.getDate() + 2);
		twoDaysFromNow.setHours(23, 59, 59, 999);

		const sevenDaysFromNow = new Date(now);
		sevenDaysFromNow.setDate(now.getDate() + 7);
		sevenDaysFromNow.setHours(23, 59, 59, 999);

		if (nextReviewDate <= now) {
			styles.dotClass = "bg-red-500 dark:bg-red-500";
			styles.textClass = "text-red-700 dark:text-red-300";
		} else if (nextReviewDate <= twoDaysFromNow) {
			styles.dotClass = "bg-orange-500 dark:bg-orange-400";
			styles.textClass = "text-orange-700 dark:text-orange-300";
		} else if (nextReviewDate <= sevenDaysFromNow) {
			styles.dotClass = "bg-yellow-500 dark:bg-yellow-400";
			styles.textClass = "text-yellow-700 dark:text-yellow-300";
		} else {
			styles.dotClass = "bg-green-500 dark:bg-green-400";
			styles.textClass = "text-green-700 dark:text-green-300";
		}

		return styles;
	}

	function getDotTitle(nextReviewDateStr: string | null | undefined): string {
		if (!nextReviewDateStr) return "Status unknown";

		const nextReviewDate = new Date(nextReviewDateStr);
		const now = new Date();

		const twoDaysFromNow = new Date(now);
		twoDaysFromNow.setDate(now.getDate() + 2);
		twoDaysFromNow.setHours(23, 59, 59, 999);

		const sevenDaysFromNow = new Date(now);
		sevenDaysFromNow.setDate(now.getDate() + 7);
		sevenDaysFromNow.setHours(23, 59, 59, 999);

		if (nextReviewDate <= now) {
			return "Overdue";
		} else if (nextReviewDate <= twoDaysFromNow) {
			return "Due Soon";
		} else if (nextReviewDate <= sevenDaysFromNow) {
			return "Due Later";
		} else {
			return "Good Standing";
		}
	}

	$: if (selectedFilePath && stage) {
		loadImage(selectedFilePath);
	}

	$: if (hasUnsavedChanges) {
		startAutoSaveTimer();
	}

	$: if (selectedRect) {
		selectedOcclusioncards = getFlashcardsUsingShape(selectedRect.id());
		flashcardInfoVisible = selectedOcclusioncards.length > 0;
	} else {
		selectedOcclusioncards = [];
		flashcardInfoVisible = false;
	}

	interface Command {
		execute(): void;
		undo(): void;
	}

	class CommandHistory {
		private undoStack: Command[] = [];
		private redoStack: Command[] = [];

		execute(command: Command): void {
			command.execute();
			this.undoStack.push(command);
			this.redoStack = [];
			hasUnsavedChanges = true;
		}

		undo(): void {
			if (this.undoStack.length === 0) return;

			const command = this.undoStack.pop()!;
			command.undo();
			this.redoStack.push(command);
		}

		redo(): void {
			if (this.redoStack.length === 0) return;

			const command = this.redoStack.pop()!;
			command.execute();
			this.undoStack.push(command);
		}

		clear(): void {
			this.undoStack = [];
			this.redoStack = [];
		}
	}

	class AddRectCommand implements Command {
		private rect: Konva.Rect;
		private layer: Konva.Layer;

		constructor(rect: Konva.Rect, layer: Konva.Layer) {
			this.rect = rect;
			this.layer = layer;
		}

		execute(): void {
			this.layer.add(this.rect);
			this.layer.draw();
		}

		undo(): void {
			this.rect.remove();
			this.layer.draw();
		}
	}

	class DeleteRectsCommand implements Command {
		private rects: Konva.Rect[];
		private layer: Konva.Layer;

		constructor(rects: Konva.Rect[], layer: Konva.Layer) {
			this.rects = [...rects];
			this.layer = layer;
		}

		execute(): void {
			this.rects.forEach((rect) => rect.remove());
			this.layer.draw();
		}

		undo(): void {
			this.rects.forEach((rect) => this.layer.add(rect));
			this.layer.draw();
		}
	}

	class MoveRectsCommand implements Command {
		private rects: Konva.Rect[];
		private oldPositions: { x: number; y: number }[];
		private newPositions: { x: number; y: number }[];
		private layer: Konva.Layer;

		constructor(rects: Konva.Rect[], layer: Konva.Layer) {
			this.rects = [...rects];
			this.layer = layer;

			this.oldPositions = rects.map((rect) => ({
				x: rect.x(),
				y: rect.y(),
			}));

			this.newPositions = [];
		}

		setNewPositions(): void {
			this.newPositions = this.rects.map((rect) => ({
				x: rect.x(),
				y: rect.y(),
			}));
		}

		execute(): void {
			this.rects.forEach((rect, i) => {
				if (this.newPositions[i]) {
					rect.position({
						x: this.newPositions[i].x,
						y: this.newPositions[i].y,
					});
				}
			});
			this.layer.draw();
		}

		undo(): void {
			this.rects.forEach((rect, i) => {
				rect.position({
					x: this.oldPositions[i].x,
					y: this.oldPositions[i].y,
				});
			});
			this.layer.draw();
		}
	}

	class TransformRectsCommand implements Command {
		private rects: Konva.Rect[];
		private oldProps: {
			width: number;
			height: number;
			scaleX: number;
			scaleY: number;
		}[];
		private newProps: {
			width: number;
			height: number;
			scaleX: number;
			scaleY: number;
		}[];
		private layer: Konva.Layer;

		constructor(rects: Konva.Rect[], layer: Konva.Layer) {
			this.rects = [...rects];
			this.layer = layer;

			this.oldProps = rects.map((rect) => ({
				width: rect.width(),
				height: rect.height(),
				scaleX: rect.scaleX(),
				scaleY: rect.scaleY(),
			}));

			this.newProps = [];
		}

		setNewProps(): void {
			this.newProps = this.rects.map((rect) => ({
				width: rect.width(),
				height: rect.height(),
				scaleX: rect.scaleX(),
				scaleY: rect.scaleY(),
			}));
		}

		execute(): void {
			this.rects.forEach((rect, i) => {
				if (this.newProps[i]) {
					rect.width(this.newProps[i].width);
					rect.height(this.newProps[i].height);
					rect.scaleX(this.newProps[i].scaleX);
					rect.scaleY(this.newProps[i].scaleY);
				}
			});
			this.layer.draw();
		}

		undo(): void {
			this.rects.forEach((rect, i) => {
				rect.width(this.oldProps[i].width);
				rect.height(this.oldProps[i].height);
				rect.scaleX(this.oldProps[i].scaleX);
				rect.scaleY(this.oldProps[i].scaleY);
			});
			this.layer.draw();
		}
	}

	let commandHistory = new CommandHistory();

	let currentMoveCommand: MoveRectsCommand | null = null;

	let currentTransformCommand: TransformRectsCommand | null = null;

	// Helper functions for cursor management
	function setCursorClass(className: string) {
		if (!konvaContainer) return;
		// Remove all cursor classes
		konvaContainer.classList.remove(
			"cursor-grab",
			"cursor-grabbing",
			"cursor-crosshair",
			"cursor-default",
		);
		// Add the new cursor class
		if (className) {
			konvaContainer.classList.add(className);
		}
	}

	function removeCursorClasses() {
		if (!konvaContainer) return;
		konvaContainer.classList.remove(
			"cursor-grab",
			"cursor-grabbing",
			"cursor-crosshair",
			"cursor-default",
		);
	}

	function getCurrentCursorClass(): string | null {
		if (!konvaContainer) return null;
		if (konvaContainer.classList.contains("cursor-grab"))
			return "cursor-grab";
		if (konvaContainer.classList.contains("cursor-grabbing"))
			return "cursor-grabbing";
		if (konvaContainer.classList.contains("cursor-crosshair"))
			return "cursor-crosshair";
		if (konvaContainer.classList.contains("cursor-default"))
			return "cursor-default";
		return null;
	}

	onMount(() => {
		setTimeout(() => {
			if (konvaContainer) {
				initializeKonva();
				setupEventListeners();

				const unsubscribe = flashcardEventStore.subscribe((event) => {
					if (event?.type === "card_reviewed") {
						if (
							plugin.notes[selectedFilePath]?.cards[
								event.cardUUID
							]
						) {
							plugin.notes[selectedFilePath].cards[
								event.cardUUID
							] = event.cardState;

							if (selectedRect) {
								selectedOcclusioncards =
									getFlashcardsUsingShape(selectedRect.id());
								flashcardInfoVisible =
									selectedOcclusioncards.length > 0;
							}

							if (
								typeof plugin.refreshUnifiedQueue === "function"
							) {
								plugin.refreshUnifiedQueue();
							}
						}
					}
				});

				resizeObserverInstance = new ResizeObserver(() => {
					if (resizeTimeout) {
						clearTimeout(resizeTimeout);
					}

					resizeTimeout = setTimeout(() => {
						if (stage) {
							resizeStage();
						}
						resizeTimeout = null;
					}, 100);
				});

				resizeObserverInstance.observe(konvaContainer);

				return () => {
					unsubscribe();
					if (resizeObserverInstance) {
						resizeObserverInstance.disconnect();
					}
				};
			}
		}, 50);

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
				if (selectedFilePath === oldPath) {
					selectedFilePath = file.path;
					loadImage(selectedFilePath);
				}
			},
		);

		return () => {
			if (stage) {
				stage.off("wheel");
				stage.off("pointerdown");
				stage.off("pointermove");
				stage.off("pointerup");
				stage.off("click");
			}

			if (transformer) {
				transformer.off("transformstart");
				transformer.off("transform");
				transformer.off("transformend");
			}

			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("keyup", handleKeyUp);

			if (konvaContainer) {
				konvaContainer.removeEventListener("pointerenter", () => {
					isCanvasFocused = true;
				});
				konvaContainer.removeEventListener("pointerleave", () => {
					isCanvasFocused = false;
				});
				konvaContainer.removeEventListener("pointerdown", () => {
					isCanvasFocused = true;
				});
			}

			clearAutoSaveTimer();

			if (resizeObserverInstance) {
				resizeObserverInstance.disconnect();
				resizeObserverInstance = null;
			}
		};
	});

	onDestroy(() => {
		// Remove any cursor classes when component is destroyed
		removeCursorClasses();

		if (stage) {
			stage.off("wheel");
			stage.off("pointerdown");
			stage.off("pointermove");
			stage.off("pointerup");
			stage.off("click");
		}

		if (transformer) {
			transformer.off("transformstart");
			transformer.off("transform");
			transformer.off("transformend");
		}

		document.removeEventListener("keydown", handleKeyDown);
		document.removeEventListener("keyup", handleKeyUp);

		if (konvaContainer) {
			konvaContainer.removeEventListener("pointerenter", () => {
				isCanvasFocused = true;
			});
			konvaContainer.removeEventListener("pointerleave", () => {
				isCanvasFocused = false;
			});
			konvaContainer.removeEventListener("pointerdown", () => {
				isCanvasFocused = true;
			});
		}

		clearAutoSaveTimer();

		if (resizeObserverInstance) {
			resizeObserverInstance.disconnect();
			resizeObserverInstance = null;
		}
	});

	function createTransformer(): Konva.Transformer {
		return new Konva.Transformer({
			keepRatio: false,
			enabledAnchors: [
				"top-left",
				"top-center",
				"top-right",
				"middle-left",
				"middle-right",
				"bottom-left",
				"bottom-center",
				"bottom-right",
			],
			rotateEnabled: false,
			borderStroke: "#0096FF",
			borderStrokeWidth: 2,
			anchorStroke: "#0096FF",
			anchorFill: "#FFFFFF",
			anchorSize: 10,
		});
	}

	function setupTransformerEventListeners() {
		transformer.on("transformstart", () => {
			if (selectedRects.length > 0) {
				currentTransformCommand = new TransformRectsCommand(
					selectedRects,
					shapeLayer,
				);
			}
		});

		transformer.on("transform", () => {});

		transformer.on("transformend", () => {
			if (selectedRects.length > 0 && currentTransformCommand) {
				selectedRects.forEach((rect) => {
					const newWidth = Math.round(rect.width() * rect.scaleX());
					const newHeight = Math.round(rect.height() * rect.scaleY());

					rect.width(newWidth);
					rect.height(newHeight);
					rect.scaleX(1);
					rect.scaleY(1);
				});

				currentTransformCommand.setNewProps();
				commandHistory.execute(currentTransformCommand);
				currentTransformCommand = null;
			}
		});
	}

	function setupStageEventListeners() {
		stage.on("pointerdown", (e) => {
			const isShiftPressed = e.evt.shiftKey;

			if (isSpacePressed && isCanvasFocused) {
				isPanning = true;
				lastPointerPosition = stage.getPointerPosition() || {
					x: 0,
					y: 0,
				};
				setCursorClass("cursor-grabbing");
				e.evt.preventDefault();
				return;
			}

			if (
				clickAndDragOcclusionMode &&
				isCanvasFocused &&
				(e.target === stage || e.target instanceof Konva.Image)
			) {
				e.evt.preventDefault();

				const pointerPos = stage.getPointerPosition();
				if (!pointerPos) return;

				const transform = stage.getAbsoluteTransform().copy().invert();
				const stagePos = transform.point(pointerPos);

				startPoint = stagePos;

				tempRect = new Konva.Rect({
					x: stagePos.x,
					y: stagePos.y,
					width: 1,
					height: 1,
					fill: colorValue,
					opacity: 1,
					listening: false,
				});

				shapeLayer.add(tempRect);
				shapeLayer.batchDraw();
				return;
			}

			if (
				(e.target === stage || !(e.target instanceof Konva.Rect)) &&
				!isShiftPressed
			) {
				transformer.nodes([]);

				selectedRects.forEach((rect) => {
					rect.draggable(false);
				});

				selectedRect = null;
				selectedRects = [];

				shapeLayer.draw();
			}
		});

		stage.on("pointermove", (e) => {
			if (isSpacePressed && !isPanning) {
				setCursorClass("cursor-grab");
			}

			if (isPanning) {
				e.evt.preventDefault();
				setCursorClass("cursor-grabbing");
				const currentPointerPosition = stage.getPointerPosition() || {
					x: 0,
					y: 0,
				};
				const dx = currentPointerPosition.x - lastPointerPosition.x;
				const dy = currentPointerPosition.y - lastPointerPosition.y;

				const newPos = {
					x: stage.x() + dx,
					y: stage.y() + dy,
				};

				stage.position(newPos);
				stage.batchDraw();

				lastPointerPosition = currentPointerPosition;
			}

			if (clickAndDragOcclusionMode && startPoint && tempRect) {
				e.evt.preventDefault();

				const pointerPos = stage.getPointerPosition();
				if (!pointerPos) return;

				const transform = stage.getAbsoluteTransform().copy().invert();
				const currentPos = transform.point(pointerPos);

				const width = currentPos.x - startPoint.x;
				const height = currentPos.y - startPoint.y;

				if (width < 0) {
					tempRect.x(currentPos.x);
					tempRect.width(Math.abs(width));
				} else {
					tempRect.width(width);
				}

				if (height < 0) {
					tempRect.y(currentPos.y);
					tempRect.height(Math.abs(height));
				} else {
					tempRect.height(height);
				}

				shapeLayer.batchDraw();
			}
		});

		stage.on("pointerup", (e) => {
			if (isPanning) {
				isPanning = false;
				setCursorClass(
					isSpacePressed ? "cursor-grab" : "cursor-default",
				);
			}

			if (clickAndDragOcclusionMode && startPoint && tempRect) {
				if (tempRect.width() > 5 && tempRect.height() > 5) {
					const newRect = createRectangle({
						x: tempRect.x(),
						y: tempRect.y(),
						width: tempRect.width(),
						height: tempRect.height(),
						fill: colorValue,
						opacity: 1,
					});

					const command = new AddRectCommand(newRect, shapeLayer);
					commandHistory.execute(command);

					selectedRects = [newRect];
					selectedRect = newRect;
					newRect.draggable(true);
					transformer.nodes([newRect]);
				}

				tempRect.destroy();
				tempRect = null;
				startPoint = null;
				shapeLayer.draw();
			}
		});

		stage.on("dragstart", (e) => {
			if (e.target instanceof Konva.Rect) {
				currentMoveCommand = new MoveRectsCommand(
					selectedRects,
					shapeLayer,
				);
			}
		});

		stage.on("dragend", (e) => {
			if (e.target instanceof Konva.Rect && currentMoveCommand) {
				currentMoveCommand.setNewPositions();
				commandHistory.execute(currentMoveCommand);
				currentMoveCommand = null;
			}
		});

		stage.on("wheel", (e) => {
			e.evt.preventDefault();

			const oldScale = stage.scaleX();

			const scaleBy = 1.03;
			const direction = e.evt.deltaY < 0 ? 1 : -1;
			const newScale =
				direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

			const pointer = stage.getPointerPosition();
			if (!pointer) return;

			const mousePointTo = {
				x: (pointer.x - stage.x()) / oldScale,
				y: (pointer.y - stage.y()) / oldScale,
			};

			stage.scale({ x: newScale, y: newScale });

			stage.position({
				x: pointer.x - mousePointTo.x * newScale,
				y: pointer.y - mousePointTo.y * newScale,
			});

			stage.batchDraw();

			refreshRectanglesAppearance();
		});
	}

	function setupContainerEventListeners() {
		konvaContainer.addEventListener("pointerenter", () => {
			isCanvasFocused = true;
			if (isSpacePressed) {
				setCursorClass(isPanning ? "cursor-grabbing" : "cursor-grab");
			} else if (clickAndDragOcclusionMode) {
				setCursorClass("cursor-crosshair");
			}
		});

		konvaContainer.addEventListener("pointerleave", () => {
			isCanvasFocused = false;
			if (
				getCurrentCursorClass() === "cursor-grab" ||
				getCurrentCursorClass() === "cursor-grabbing" ||
				getCurrentCursorClass() === "cursor-crosshair"
			) {
				removeCursorClasses();
			}

			if (isPanning) {
				isPanning = false;
			}

			if (clickAndDragOcclusionMode && tempRect) {
				tempRect.destroy();
				tempRect = null;
				startPoint = null;
				shapeLayer.draw();
			}
		});

		konvaContainer.addEventListener("pointerdown", () => {
			isCanvasFocused = true;
		});
	}

	function initializeKonva() {
		if (!konvaContainer) return;

		stage = new Konva.Stage({
			container: konvaContainer,
			width: konvaContainer.clientWidth,
			height: konvaContainer.clientHeight,
		});

		imageLayer = new Konva.Layer();
		shapeLayer = new Konva.Layer();

		stage.add(imageLayer);
		stage.add(shapeLayer);

		transformer = createTransformer();
		shapeLayer.add(transformer);

		setupTransformerEventListeners();
	}

	function setupEventListeners() {
		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("keyup", handleKeyUp);

		setupContainerEventListeners();
		setupStageEventListeners();
	}

	function handleFileSelect(file: TFile) {
		selectedFilePath = file.path;
		loadImage(selectedFilePath);
	}

	function resizeStage() {
		if (
			!validateContainer("resize stage") ||
			!validateStage("resize stage")
		) {
			return;
		}

		const containerWidth = konvaContainer.clientWidth;
		const containerHeight = konvaContainer.clientHeight;

		if (containerWidth === 0 || containerHeight === 0) {
			console.warn("Container has zero dimensions, delaying resize");
			return;
		}

		stage.width(containerWidth);
		stage.height(containerHeight);

		const backgroundImage = imageLayer.findOne("Image") as Konva.Image;
		if (backgroundImage) {
			const imgWidth = backgroundImage.width();
			const imgHeight = backgroundImage.height();

			const scaleX = containerWidth / imgWidth;
			const scaleY = containerHeight / imgHeight;
			const scale = Math.min(scaleX, scaleY);

			const centerX = (containerWidth - imgWidth * scale) / 2;
			const centerY = (containerHeight - imgHeight * scale) / 2;

			stage.position({ x: 0, y: 0 });
			stage.scale({ x: 1, y: 1 });

			stage.position({
				x: centerX,
				y: centerY,
			});

			stage.scale({
				x: scale,
				y: scale,
			});

			backgroundImage.position({ x: 0, y: 0 });
			backgroundImage.scale({ x: 1, y: 1 });
		}

		stage.batchDraw();

		refreshRectanglesAppearance();
	}

	async function loadImage(filePath: string) {
		try {
			if (!validateStage("load image")) {
				return;
			}

			if (!validateFilePath("load image")) {
				return;
			}

			imageLayer.destroyChildren();
			shapeLayer.destroyChildren();

			transformer = createTransformer();
			shapeLayer.add(transformer);

			const file = plugin.app.vault.getAbstractFileByPath(filePath);
			if (!file) {
				console.error("File not found:", filePath);
				return;
			}

			if (!file.path || typeof file.basename !== "string") {
				console.error("Invalid file object:", file);
				return;
			}

			const data = await plugin.app.vault.readBinary(file);
			const blob = new Blob([data]);
			const url = URL.createObjectURL(blob);

			const img = new Image();

			await new Promise<void>((resolve, reject) => {
				img.onload = () => {
					try {
						const nativeWidth = img.naturalWidth;
						const nativeHeight = img.naturalHeight;

						const kImage = new Konva.Image({
							image: img,
							x: 0,
							y: 0,
							width: nativeWidth,
							height: nativeHeight,
						});

						imageLayer.destroyChildren();
						imageLayer.add(kImage);
						imageLayer.batchDraw();

						requestAnimationFrame(() => {
							resizeStage();
							loadSavedShapes(filePath);
						});

						resolve();
					} catch (err) {
						reject(err);
					} finally {
						URL.revokeObjectURL(url);
					}
				};

				img.onerror = (error) => {
					URL.revokeObjectURL(url);
					reject(new Error(`Failed to load image: ${error}`));
				};

				img.src = url;
			});
		} catch (error) {
			console.error(`Error load image: ${error.message || error}`);
		}
	}

	function setupRectangle(rect: Konva.Rect): Konva.Rect {
		rect.on("pointerdown", (e) => {
			handleRectClick(rect, e);

			if (!selectedRects.includes(rect) && !e.evt.shiftKey) {
				rect.draggable(false);
			}
		});

		updateRectangleAppearance(rect);
		return rect;
	}

	function createRectangle(props: {
		x: number;
		y: number;
		width: number;
		height: number;
		fill: string;
		opacity: number;
		id?: string;
	}): Konva.Rect {
		const rectId = props.id || generateUUID();

		const rect = new Konva.Rect({
			x: props.x,
			y: props.y,
			width: props.width,
			height: props.height,
			fill: props.fill,
			opacity: props.opacity,
			draggable: false,
			scaleX: 1,
			scaleY: 1,
			id: rectId,
		});

		return setupRectangle(rect);
	}

	function loadSavedShapes(filePath: string) {
		const shapes = plugin.notes[filePath]?.data.occlusion || [];
		const tags = plugin.notes[filePath]?.data.tags || [];

		// Load tags for this image
		imageTags = Array.isArray(tags) ? tags : [];

		// Update available tags
		allAvailableTags = collectAllAvailableTags();

		shapes.forEach((s: any) => {
			const rect = createRectangle({
				x: s.x,
				y: s.y,
				width: s.width,
				height: s.height,
				fill: s.fill,
				opacity: s.opacity,
				id: s.id || generateUUID(),
			});

			shapeLayer.add(rect);
		});

		shapeLayer.draw();

		refreshRectanglesAppearance();
	}

	function handleRectClick(
		rect: Konva.Rect,
		e: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
	) {
		e.evt.stopPropagation();

		const isShiftPressed = e.evt.shiftKey;

		if (!isShiftPressed) {
			selectedRects.forEach((r) => {
				r.draggable(false);
			});
			selectedRects = [];
		}

		if (!selectedRects.includes(rect)) {
			selectedRects.push(rect);
		}

		selectedRect = rect;
		selectedRects.forEach((r) => r.draggable(true));
		transformer.nodes(selectedRects);
		colorValue = rect.fill() as string;

		selectedOcclusioncards = getFlashcardsUsingShape(rect.id());
		flashcardInfoVisible = selectedOcclusioncards.length > 0;

		shapeLayer.draw();
	}

	function addRectangle() {
		const stagePos = stage.position();
		const scale = stage.scale().x;

		const viewportCenterX = (stage.width() / 2 - stagePos.x) / scale;
		const viewportCenterY = (stage.height() / 2 - stagePos.y) / scale;

		const rectWidth = 100;
		const rectHeight = 100;

		const rect = createRectangle({
			x: viewportCenterX - rectWidth / 2,
			y: viewportCenterY - rectHeight / 2,
			width: rectWidth,
			height: rectHeight,
			fill: colorValue,
			opacity: 1,
		});

		const command = new AddRectCommand(rect, shapeLayer);
		commandHistory.execute(command);

		selectedRects = [rect];
		selectedRect = rect;
		rect.draggable(true);
		transformer.nodes([rect]);

		colorValue = rect.fill() as string;
	}

	function deleteSelectedRects() {
		if (selectedRects.length === 0) return;

		const flashcardsToDelete = new Set<string>();
		selectedRects.forEach((rect) => {
			const associatedCards = getFlashcardsUsingShape(rect.id());
			associatedCards.forEach((card) => {
				if (card && typeof card === "object" && "cardUUID" in card) {
					flashcardsToDelete.add(card.cardUUID as string);
				}
			});
		});

		if (flashcardsToDelete.size > 0) {
			flashcardsToDelete.forEach((cardUUID) => {
				const uuid = cardUUID as string;
				if (plugin.notes[selectedFilePath].cards[uuid]) {
					delete plugin.notes[selectedFilePath].cards[uuid];
				}
			});

			plugin.savePluginData().then(() => {
				new Notice(
					`Deleted ${flashcardsToDelete.size} associated flashcard${flashcardsToDelete.size > 1 ? "s" : ""}`,
				);

				if (typeof plugin.refreshUnifiedQueue === "function") {
					plugin.refreshUnifiedQueue();
				}
			});
		}

		const command = new DeleteRectsCommand(selectedRects, shapeLayer);
		commandHistory.execute(command);

		transformer.nodes([]);
		selectedRect = null;
		selectedRects = [];
	}

	function undo() {
		commandHistory.undo();
		updateSelectionState();
	}

	function redo() {
		commandHistory.redo();
		updateSelectionState();
	}

	function updateSelectionState() {
		selectedRects = [];
		selectedRect = null;
		transformer.nodes([]);

		shapeLayer.getChildren().forEach((child: Konva.Node) => {
			if (child instanceof Konva.Rect) {
				child.draggable(false);
			}
		});

		shapeLayer.draw();
	}

	function clearAutoSaveTimer() {
		if (autoSaveTimer !== null) {
			clearTimeout(autoSaveTimer);
			autoSaveTimer = null;
		}
	}

	function startAutoSaveTimer() {
		clearAutoSaveTimer();

		autoSaveTimer = setTimeout(() => {
			if (hasUnsavedChanges) {
				saveOcclusionData(true);
			}
			autoSaveTimer = null;
		}, 3000);
	}

	function collectShapeData(rects: Konva.Rect[]): OcclusionShape[] {
		return rects.map((rect) => ({
			x: rect.x(),
			y: rect.y(),
			width: rect.width() * rect.scaleX(),
			height: rect.height() * rect.scaleY(),
			fill: rect.fill() as string,
			opacity: rect.opacity(),
			id: rect.id() || generateUUID(),
		}));
	}

	function collectAllShapesFromLayer(): OcclusionShape[] {
		const shapes: OcclusionShape[] = [];

		shapeLayer.getChildren().forEach((child) => {
			if (child instanceof Konva.Rect) {
				shapes.push({
					x: child.x(),
					y: child.y(),
					width: child.width() * child.scaleX(),
					height: child.height() * child.scaleY(),
					fill: child.fill() as string,
					opacity: child.opacity(),
					id: child.id() || generateUUID(),
				});
			}
		});

		return shapes;
	}

	async function saveOcclusionData(isAutoSave = false) {
		try {
			if (!validateFilePath("save occlusion data")) {
				return;
			}

			if (!shapeLayer) {
				console.warn(
					"Cannot save occlusion data - shape layer not initialized",
				);
				return;
			}

			const shapes = collectAllShapesFromLayer();

			if (!plugin.notes[selectedFilePath]) {
				plugin.notes[selectedFilePath] = {
					cards: {},
					data: { noteVisitLog: [] },
				};
			}

			plugin.notes[selectedFilePath].data.occlusion = shapes;

			// Save tags
			if (imageTags.length > 0) {
				plugin.notes[selectedFilePath].data.tags = imageTags;
			} else {
				// Remove tags property if no tags
				delete plugin.notes[selectedFilePath].data.tags;
			}

			await plugin.savePluginData();

			refreshReadingViews();

			clearAutoSaveTimer();

			hasUnsavedChanges = false;

			if (!isAutoSave) {
				new Notice("Occlusion data saved!");
			} else {
				console.log("Auto-save completed");
			}

			// Refresh the review queue to update tag filtering
			if (typeof plugin.refreshUnifiedQueue === "function") {
				plugin.refreshUnifiedQueue();
			}
		} catch (error) {
			console.error(
				`Error save occlusion data: ${error.message || error}`,
			);
		}
	}

	function refreshReadingViews(): void {
		const leaves = plugin.app.workspace.getLeavesOfType("markdown");

		for (const leaf of leaves) {
			const view = leaf.view;

			if (view instanceof MarkdownView && view.getMode() === "preview") {
				const previewEl = view.previewMode.containerEl.querySelector(
					".markdown-preview-view",
				);
				if (!previewEl) continue;

				const scrollPercentage =
					previewEl.scrollTop /
					(previewEl.scrollHeight - previewEl.clientHeight);

				view.previewMode.rerender(true);

				requestAnimationFrame(() => {
					const newScrollPosition =
						scrollPercentage *
						(previewEl.scrollHeight - previewEl.clientHeight);
					previewEl.scrollTop = newScrollPosition;
				});
			}
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		const activeElement = document.activeElement;
		const isInputFocused =
			activeElement instanceof HTMLInputElement ||
			activeElement instanceof HTMLTextAreaElement;

		if (e.code === "Space" && !isInputFocused && isCanvasFocused) {
			if (!isSpacePressed) {
				isSpacePressed = true;
				setCursorClass("cursor-grab");

				e.preventDefault();
				e.stopPropagation();
			}
			return;
		}

		if (e.key.toLowerCase() === "d" && !isInputFocused && isCanvasFocused) {
			e.preventDefault();
			toggleClickAndDragOcclusionMode();
			return;
		}

		if (!isInputFocused && isCanvasFocused) {
			if (
				(e.key === "Backspace" || e.key === "Delete") &&
				selectedRects.length > 0
			) {
				e.preventDefault();
				deleteSelectedRects();
			}

			if (
				e.key === "c" &&
				(e.metaKey || e.ctrlKey) &&
				selectedRects.length > 0
			) {
				e.preventDefault();
				copySelectedRects();
			}

			if (e.key === "v" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				pasteRects();
			}

			if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
				e.preventDefault();
				undo();
			}

			if (
				(e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey) ||
				(e.key === "y" && (e.metaKey || e.ctrlKey))
			) {
				e.preventDefault();
				redo();
			}
		}
	}

	function handleKeyUp(e: KeyboardEvent) {
		if (e.code === "Space") {
			isSpacePressed = false;
			if (isCanvasFocused) {
				removeCursorClasses();
				e.preventDefault();
				e.stopPropagation();
			}
		}
	}

	function copySelectedRects() {
		if (selectedRects.length === 0) return;

		copiedRects = [];

		selectedRects.forEach((rect) => {
			copiedRects.push({
				x: rect.x(),
				y: rect.y(),
				width: rect.width() * rect.scaleX(),
				height: rect.height() * rect.scaleY(),
				fill: rect.fill() as string,
				opacity: rect.opacity(),
			});
		});
	}

	function pasteRects() {
		if (copiedRects.length === 0) return;

		selectedRects.forEach((rect) => {
			rect.draggable(false);
		});
		selectedRects = [];

		const offsetX = 20;
		const offsetY = 20;

		const newRects: Konva.Rect[] = [];

		copiedRects.forEach((rectData) => {
			const rect = createRectangle({
				x: rectData.x + offsetX,
				y: rectData.y + offsetY,
				width: rectData.width,
				height: rectData.height,
				fill: rectData.fill,
				opacity: rectData.opacity,
			});

			rect.draggable(true);

			newRects.push(rect);
			selectedRects.push(rect);
			shapeLayer.add(rect);
		});

		if (selectedRects.length > 0) {
			selectedRect = selectedRects[selectedRects.length - 1];

			colorValue = selectedRect.fill() as string;
		}

		transformer.nodes(selectedRects);
		shapeLayer.draw();
	}

	function updateSelectedRectangleColor() {
		if (!selectedRect) return;

		const affectedRects = [selectedRect];
		const transformCommand = new TransformRectsCommand(
			affectedRects,
			shapeLayer,
		);

		selectedRect.fill(colorValue);
		transformCommand.setNewProps();
		commandHistory.execute(transformCommand);

		hasUnsavedChanges = true;
	}

	function createFlashcard(mode: "HideAll" | "HideOne") {
		if (!selectedFilePath) {
			new Notice("Please select an image first");
			return;
		}

		const shapesToUse =
			selectedRects.length > 0 ? collectShapeData(selectedRects) : [];

		if (shapesToUse.length === 0) {
			new Notice("Please select at least one occlusion");
			return;
		}

		createOcclusionFlashcard(shapesToUse, mode);
	}

	function createHideAllFlashcard() {
		createFlashcard("HideAll");
	}

	function createHideOneFlashcard() {
		createFlashcard("HideOne");
	}

	function createOcclusionFlashcard(
		shapes: OcclusionShape[],
		mode: "HideAll" | "HideOne",
	) {
		const cardUUID = generateUUID();
		const cardContent = ``;
		const file = plugin.app.vault.getAbstractFileByPath(selectedFilePath);
		const fileName =
			file instanceof TFile ? file.basename : "Occlusion Card";

		if (!plugin.notes[selectedFilePath]) {
			plugin.notes[selectedFilePath] = {
				cards: {},
				data: { noteVisitLog: [] },
			};
		}

		const now = new Date().toISOString();
		const shapeIds = shapes.map((shape) => {
			return shape.id || generateUUID();
		});

		plugin.notes[selectedFilePath].cards[cardUUID] = {
			cardUUID,
			cardContent,
			repetition: 0,
			interval: 0,
			ef: 2.5,
			lastReviewDate: now,
			createdAt: now,
			nextReviewDate: now,
			active: true,
			efHistory: [
				{
					timestamp: now,
					ef: 2.5,
					rating: 3,
				},
			],
			cardTitle: `${fileName} (${mode})`,
			line: 1,
			occlusionData: {
				mode,
				shapeIds,
			},
		};

		hasUnsavedChanges = true;

		plugin.savePluginData().then(() => {
			new Notice(`${mode} flashcard created for ${fileName}`);

			refreshRectanglesAppearance();

			if (selectedRect) {
				selectedOcclusioncards = getFlashcardsUsingShape(
					selectedRect.id(),
				);
				flashcardInfoVisible = selectedOcclusioncards.length > 0;
			}

			if (typeof plugin.refreshUnifiedQueue === "function") {
				plugin.refreshUnifiedQueue();
			}
		});
	}

	function handleSaveButtonClick() {
		saveOcclusionData(false);
	}

	function updateRectangleAppearance(rect: Konva.Rect) {
		const rectId = rect.id();
		const isUsedInFlashcard = checkIfUsedInFlashcard(rectId);

		if (isUsedInFlashcard) {
			rect.strokeEnabled(true);
			rect.stroke("#22C55E");
			const baseStrokeWidth = 2;

			let strokeWidth = baseStrokeWidth;
			if (stage) {
				const stageScale = stage.scale().x;
				strokeWidth = baseStrokeWidth / stageScale;

				strokeWidth = Math.max(0.5, Math.min(5, strokeWidth));
			}

			rect.strokeWidth(strokeWidth);
			rect.dash([]);
		} else {
			rect.strokeEnabled(false);
		}
	}

	function toggleClickAndDragOcclusionMode() {
		clickAndDragOcclusionMode = !clickAndDragOcclusionMode;

		if (tempRect) {
			tempRect.destroy();
			tempRect = null;
		}
		startPoint = null;

		if (clickAndDragOcclusionMode && isCanvasFocused) {
			setCursorClass("cursor-crosshair");
			new Notice("Click and drag to create occlusions");
		} else if (!isSpacePressed) {
			removeCursorClasses();
		}
	}

	function checkIfUsedInFlashcard(shapeId: string) {
		if (!selectedFilePath || !plugin.notes[selectedFilePath]) return false;

		const cards = plugin.notes[selectedFilePath].cards || {};
		return Object.values(cards).some((card: any) => {
			return (
				card.occlusionData &&
				card.occlusionData.shapeIds &&
				card.occlusionData.shapeIds.includes(shapeId)
			);
		});
	}

	function getFlashcardsUsingShape(shapeId: string): CardState[] {
		if (!shapeId) return [];
		if (!selectedFilePath || !plugin.notes[selectedFilePath]) return [];

		const cards = plugin.notes[selectedFilePath].cards || {};
		return Object.values(cards).filter((card): card is CardState => {
			const cardWithData = card as {
				occlusionData?: { shapeIds: string[] };
			};
			return Boolean(
				card &&
					typeof card === "object" &&
					cardWithData.occlusionData &&
					Array.isArray(cardWithData.occlusionData.shapeIds) &&
					cardWithData.occlusionData.shapeIds.includes(shapeId),
			);
		});
	}

	function deleteFlashcard(cardUUID: string) {
		if (!selectedFilePath || !plugin.notes[selectedFilePath]) return;

		if (plugin.notes[selectedFilePath].cards[cardUUID]) {
			delete plugin.notes[selectedFilePath].cards[cardUUID];
			plugin.savePluginData().then(() => {
				new Notice("Flashcard deleted");

				if (selectedRect) {
					selectedOcclusioncards = getFlashcardsUsingShape(
						selectedRect.id(),
					);
					flashcardInfoVisible = selectedOcclusioncards.length > 0;
				}

				refreshRectanglesAppearance();

				if (typeof plugin.refreshUnifiedQueue === "function") {
					plugin.refreshUnifiedQueue();
				}
			});
		}
	}

	function refreshRectanglesAppearance() {
		shapeLayer.getChildren().forEach((child: Konva.Node) => {
			if (child instanceof Konva.Rect) {
				updateRectangleAppearance(child);
			}
		});
		shapeLayer.draw();
	}

	function reviewFlashcard(cardUUID: string) {
		if (!cardUUID) {
			console.warn("Cannot review flashcard - no card UUID provided");
			return;
		}

		if (
			!validateFilePath("review flashcard") ||
			!validateNoteData("review flashcard")
		) {
			return;
		}

		const card = plugin.notes[selectedFilePath].cards[cardUUID];
		if (!card) {
			console.warn(
				`Cannot review flashcard - card ${cardUUID} not found`,
			);
			return;
		}

		const file = plugin.app.vault.getAbstractFileByPath(selectedFilePath);
		if (!file || !(file instanceof TFile)) {
			console.warn("Cannot review flashcard - file not found or invalid");
			return;
		}

		const flashcard = {
			uuid: cardUUID,
			content: card.cardContent,
			noteTitle: file.basename,
			filePath: selectedFilePath,
			cardTitle: card.cardTitle,
			line: card.line,
		};

		createFlashcardModal(
			plugin.app,
			[flashcard],
			plugin as any,
			true,
			[],
			null,
		).open();
	}

	function validateStage(context: string = ""): boolean {
		if (!stage) {
			console.warn(`Cannot ${context} - stage not initialized`);
			return false;
		}
		return true;
	}

	function validateFilePath(context: string = ""): boolean {
		if (!selectedFilePath) {
			console.warn(`Cannot ${context} - no file path provided`);
			return false;
		}
		return true;
	}

	function validateNoteData(context: string = ""): boolean {
		if (!plugin.notes[selectedFilePath]) {
			console.warn(`Cannot ${context} - note data not available`);
			return false;
		}
		return true;
	}

	function validateContainer(context: string = ""): boolean {
		if (!konvaContainer) {
			console.warn(`Cannot ${context} - container not available`);
			return false;
		}
		return true;
	}

	function collectAllAvailableTags() {
		const tempTags = new Set<string>();

		// Collect tags from markdown files
		for (const notePath in plugin.notes) {
			if (notePath.endsWith(".md")) {
				const file = plugin.app.vault.getAbstractFileByPath(notePath);
				if (file && file instanceof TFile) {
					const fileCache =
						plugin.app.metadataCache.getFileCache(file);
					const tags = fileCache?.frontmatter?.tags;
					if (tags) {
						if (Array.isArray(tags)) {
							tags.forEach((tag: string) => tempTags.add(tag));
						} else {
							tempTags.add(tags);
						}
					}
				}
			}
		}

		// Collect tags from image files with occlusion data
		for (const notePath in plugin.notes) {
			if (notePath.match(/\.(png|jpe?g|gif)$/i)) {
				const tags = plugin.notes[notePath]?.data?.tags;
				if (tags && Array.isArray(tags)) {
					tags.forEach((tag: string) => tempTags.add(tag));
				}
			}
		}

		return tempTags;
	}

	function handleTagsChange(event: CustomEvent<string[]>) {
		imageTags = event.detail;
		hasUnsavedChanges = true;
	}
</script>

<div
	class="flex flex-col h-full bg-gray-50 occlusion-editor dark:bg-gray-800"
	bind:this={containerEl}
>
	<!-- Toolbar -->
	<div
		class="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-600"
	>
		<!-- File row -->
		<div
			class="flex flex-col gap-2 justify-between items-center p-2 mb-2 border-b border-gray-100 sm:flex-row dark:border-gray-700"
		>
			<!-- Left: File selection -->
			<FileSelection
				{plugin}
				{selectedFilePath}
				onFileSelect={handleFileSelect}
			/>

			<!-- Right: Mode, Save, Undo, Redo -->
			<EditorControls
				{hasUnsavedChanges}
				onUndo={undo}
				onRedo={redo}
				onSave={handleSaveButtonClick}
			/>
		</div>

		<!-- Tools row -->
		<ToolsRow
			{colorValue}
			{clickAndDragOcclusionMode}
			onCreateHideAllFlashcard={createHideAllFlashcard}
			onCreateHideOneFlashcard={createHideOneFlashcard}
			onAddRectangle={addRectangle}
			onToggleClickAndDragMode={toggleClickAndDragOcclusionMode}
			onUpdateSelectedRectangleColor={updateSelectedRectangleColor}
		/>

		<!-- Tag Manager -->
		<div class="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
			<TagManager
				bind:tags={imageTags}
				{allAvailableTags}
				on:change={handleTagsChange}
			/>
		</div>
	</div>

	<!-- Main content area with relative positioning -->
	<div class="relative flex-1">
		<!-- Konva Container - Full height now -->
		<div
			class="overflow-auto absolute inset-0 bg-white border border-gray-300 dark:border-gray-600 dark:bg-gray-900"
			bind:this={konvaContainer}
		></div>

		<!-- Replace the old flashcard panel with the new component -->
		<FlashcardInfoPanel
			{selectedOcclusioncards}
			{selectedRect}
			onReviewFlashcard={reviewFlashcard}
			onDeleteFlashcard={deleteFlashcard}
		/>
	</div>
</div>
