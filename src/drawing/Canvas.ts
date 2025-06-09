import * as fabric from "fabric";
import { FabricObject } from "fabric";
import { App } from "obsidian";
import { IBrush } from "./Tools";

export interface DrawingData {
	drawings: {
		[filePath: string]: {
			json: string;
			viewState?: ViewState;
		};
	};
}

export interface DrawingOptions {
	container: HTMLElement;
	width: number;
	height: number;
}

export interface ViewState {
	vpt: [number, number, number, number, number, number];
	backgroundColor?: string;
}

type CanvasSnapshot = {
	json: string;
	view: ViewState | null;
};

export class ICanvas extends fabric.Canvas {
	private app: App;
	protected savedViewState: ViewState | null = null;

	private undoStack: CanvasSnapshot[] = [];
	private redoStack: CanvasSnapshot[] = [];
	private historyPaused = false;
	private batchCount = 0;
	private static MAX_STACK = 100;
	private stylusGuard?: () => void;
	private stylusOnly = false;

	constructor(app: App, options: DrawingOptions) {
		const canvasElement = document.createElement("canvas");
		canvasElement.width = options.width;
		canvasElement.height = options.height;
		options.container.appendChild(canvasElement);

		super(canvasElement, {
			isDrawingMode: true,
			width: options.width,
			height: options.height,
			backgroundColor: "white",
			selection: false,
			enablePointerEvents: true,
		});

		this.app = app;

		const push = () => {
			this.pushSnapshot();
		};

		this.on("object:added", push);
		this.on("object:modified", push);
		this.on("object:removed", push);

		this.pushSnapshot();

		this.selectionColor = "rgba(37, 99, 235, 0.1)";
		this.selectionBorderColor = "#2563eb";
		this.selectionLineWidth = 1;

		FabricObject.ownDefaults.borderColor = "#2563eb";
		FabricObject.ownDefaults.borderScaleFactor = 1;
		FabricObject.ownDefaults.transparentCorners = true;
		FabricObject.ownDefaults.hasControls = false;
		FabricObject.ownDefaults.hasBorders = true;
	}

	public startBatchOperation(): void {
		this.batchCount++;
		this.historyPaused = true;
	}

	public endBatchOperation(): void {
		this.batchCount--;
		if (this.batchCount <= 0) {
			this.batchCount = 0;
			this.historyPaused = false;
		}
	}

	public asBatchedOperation<T>(fn: (canvas: ICanvas) => T): T {
		this.startBatchOperation();
		try {
			return fn(this);
		} finally {
			this.endBatchOperation();
			this.pushSnapshot();
		}
	}

	public withPausedHistory<T>(fn: (canvas: ICanvas) => T): T {
		this.startBatchOperation();
		try {
			return fn(this);
		} finally {
			this.endBatchOperation();
		}
	}

	private captureSnapshot(): CanvasSnapshot {
		return {
			json: JSON.stringify(this.toJSON()),
			view: this.getViewState(),
		};
	}

	public pushSnapshot() {
		if (this.historyPaused) return;
		console.log("pushing snapshot");

		const snap = this.captureSnapshot();

		this.undoStack.push(snap);
		this.redoStack.length = 0;
		if (this.undoStack.length > ICanvas.MAX_STACK) {
			this.undoStack.shift();
		}
	}

	public undo() {
		if (this.undoStack.length <= 1) return;

		const current = this.undoStack.pop()!;
		const previous = this.undoStack.at(-1);

		if (!previous) {
			this.undoStack.push(current);
			return;
		}

		this.startBatchOperation();
		this.loadFromJSON(previous.json).then(() => {
			this.redoStack.push(current);
			this.renderAll();
			this.endBatchOperation();
		});
	}

	public async redo() {
		const next = this.redoStack.pop();
		if (!next) return;

		this.undoStack.push(next);
		this.startBatchOperation();
		this.loadFromJSON(next.json).then(() => {
			this.renderAll();
			this.endBatchOperation();
		});
	}

	public getJSON(): string {
		return JSON.stringify(this.toJSON());
	}

	public clear(): void {
		this.asBatchedOperation(() => {
			const currentBackground = this.backgroundColor;
			super.clear();
			this.backgroundColor = currentBackground || "#ffffff";
			this.renderAll();
		});
	}

	public resize(width: number, height: number): void {
		this.withPausedHistory(() => {
			this.setDimensions({ width, height });
			this.renderAll();
		});
	}

	public resetView() {
		if (!this.viewportTransform) return;

		const currentVpt = this.viewportTransform;
		if (!currentVpt) return;

		const targetVpt: [number, number, number, number, number, number] = this
			.savedViewState?.vpt || [1, 0, 0, 1, 0, 0];

		const duration = 500;
		const startTime = Date.now();

		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			const eased =
				progress < 0.5
					? 2 * progress * progress
					: -1 + (4 - 2 * progress) * progress;

			const newVpt: [number, number, number, number, number, number] = [
				currentVpt[0] + (targetVpt[0] - currentVpt[0]) * eased,
				currentVpt[1] + (targetVpt[1] - currentVpt[1]) * eased,
				currentVpt[2] + (targetVpt[2] - currentVpt[2]) * eased,
				currentVpt[3] + (targetVpt[3] - currentVpt[3]) * eased,
				currentVpt[4] + (targetVpt[4] - currentVpt[4]) * eased,
				currentVpt[5] + (targetVpt[5] - currentVpt[5]) * eased,
			];

			this.setViewportTransform(newVpt);

			if (progress < 1) {
				requestAnimationFrame(animate);
			}
		};

		animate();
	}

	public getViewState(): ViewState | null {
		const vpt = this.viewportTransform;
		if (!vpt) return null;

		return {
			vpt: [vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]],
			backgroundColor: this.backgroundColor as string,
		};
	}

	public setViewState(state: ViewState | null) {
		if (!state || !state.vpt) {
			this.setViewportTransform([1, 0, 0, 1, 0, 0]);
		} else {
			this.setViewportTransform(state.vpt);
			if (state.backgroundColor) {
				this.backgroundColor = state.backgroundColor;
			}
		}
		this.renderAll();
	}

	public saveCurrentViewAsDefault() {
		this.savedViewState = this.getViewState();
	}

	public enableStylusOnlyMode() {
		if (this.stylusOnly) return;
		this.stylusOnly = true;

		const el = this.upperCanvasEl;

		el.classList.add("sample-note-stylus-only");

		const gate = (e: PointerEvent) => {
			if (e.pointerType !== "pen") {
				e.preventDefault();
				e.stopImmediatePropagation();
				return;
			}
			if (e.type === "pointerdown") {
				el.setPointerCapture(e.pointerId);
			} else if (e.type === "pointerup" || e.type === "pointercancel") {
				el.releasePointerCapture(e.pointerId);
			}
		};

		const scribbleFix = (e: TouchEvent) => e.preventDefault();

		const skipTargetFind = (e: PointerEvent) => {
			this.skipTargetFind = e.pointerType !== "pen";
		};

		const events = [
			"pointerdown",
			"pointermove",
			"pointerup",
			"pointercancel",
		];
		const disposers = events.map((type) => {
			const handler = (e: PointerEvent) => gate(e);
			el.addEventListener(type, handler, { capture: true });
			return () => el.removeEventListener(type, handler, true);
		});

		el.addEventListener("touchmove", scribbleFix, { passive: false });
		disposers.push(() => el.removeEventListener("touchmove", scribbleFix));

		el.addEventListener("pointerdown", skipTargetFind, { capture: true });
		disposers.push(() =>
			el.removeEventListener("pointerdown", skipTargetFind, true)
		);

		this.stylusGuard = () => disposers.forEach((dispose) => dispose());
	}

	public disableStylusOnlyMode() {
		if (!this.stylusOnly || !this.stylusGuard) return;
		this.stylusGuard();
		this.stylusGuard = undefined;
		this.stylusOnly = false;
		this.skipTargetFind = false;

		this.upperCanvasEl.classList.remove("sample-note-stylus-only");
	}
}

export enum ToolType {
	DefaultBrush = "defaultBrush",
	Highlighter = "highlighter",
	Eraser = "eraser",
	Selection = "selection",
	Pan = "pan",
	PerfectFreehand = "perfectfreehand",
	SelectionBrush = "selectionbrush",
}

export enum SizeType {
	Small = "small",
	Medium = "medium",
	Large = "large",
}

export interface ToolSize {
	name: SizeType;
	width: number;
	title: string;
}

export interface Tool {
	type: ToolType;
	icon: string;
	title: string;
	activate: (canvas: ICanvas, size: number) => void;
	getBrush?: () => IBrush | null;
}
