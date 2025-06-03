import * as fabric from "fabric";
import { getStroke, StrokeOptions } from "perfect-freehand";
import { ICanvas } from "./Canvas";

export interface IBrush {
	width?: number;
	color?: string;
	canvas: ICanvas;
	setWidth(width: number): void;
	setColor(color: string): void;
}

export abstract class IBaseBrush extends fabric.BaseBrush implements IBrush {
	public canvas: ICanvas;

	public setColor(color: string): void {
		this.color = color;
	}

	public setWidth(width: number): void {
		this.width = width;
	}

	constructor(canvas: ICanvas) {
		super(canvas);
	}
}

export abstract class IPencilBrush
	extends fabric.PencilBrush
	implements IBrush
{
	public canvas: ICanvas;

	public setColor(color: string): void {
		this.color = color;
	}

	public setWidth(width: number): void {
		this.width = width;
	}

	public setDecimate(value: number): void {
		this.decimate = value;
	}

	constructor(canvas: ICanvas) {
		super(canvas);
		this.decimate = 0;
	}
}

export class SelectionBrush extends IBaseBrush {
	private _points: fabric.Point[] = [];
	private minSelectionPoints: number = 5;
	private _cachedCanvas1: HTMLCanvasElement;
	private _cachedCanvas2: HTMLCanvasElement;
	private _cachedCtx1: CanvasRenderingContext2D;
	private _cachedCtx2: CanvasRenderingContext2D;

	constructor(canvas: ICanvas) {
		super(canvas);

		this.width = 2.0;
		this.color = "rgba(51, 153, 255, 0.7)";
		this.strokeDashArray = [5, 5];
		this.strokeLineCap = "round";

		this._cachedCanvas1 = document.createElement("canvas");
		this._cachedCanvas2 = document.createElement("canvas");
		this._cachedCtx1 = this._cachedCanvas1.getContext("2d", {
			willReadFrequently: true,
		})!;
		this._cachedCtx2 = this._cachedCanvas2.getContext("2d", {
			willReadFrequently: true,
		})!;
	}

	onMouseDown(pointer: fabric.Point, options: any): void {
		this.canvas.isDrawingMode = true;
		this._points = [new fabric.Point(pointer.x, pointer.y)];

		this._saveAndTransform(this.canvas.contextTop);
		this._render(this.canvas.contextTop);
	}

	onMouseMove(pointer: fabric.Point, options: any): void {
		if (this._points.length > 0) {
			this._points.push(new fabric.Point(pointer.x, pointer.y));

			this.canvas.clearContext(this.canvas.contextTop);
			this._render(this.canvas.contextTop);
		}
	}

	onMouseUp(options: fabric.TEvent<fabric.TPointerEvent>): boolean {
		if (this._points.length > 0) {
			this._points.push(this._points[0]);
		}

		if (this._points.length >= this.minSelectionPoints) {
			this.canvas.asBatchedOperation((canvas) => {
				this.processSelection();
			});
		}

		this.canvas.contextTop.restore();
		this.canvas.clearContext(this.canvas.contextTop);
		this._points = [];

		return false;
	}

	_render(ctx: CanvasRenderingContext2D = this.canvas.contextTop): void {
		const points = this._points;
		if (!points || points.length < 2) return;

		ctx.strokeStyle = this.color;
		ctx.lineWidth = this.width;

		if (this.strokeDashArray) {
			ctx.setLineDash(this.strokeDashArray);
		}

		ctx.lineCap = this.strokeLineCap as CanvasLineCap;

		ctx.beginPath();
		ctx.moveTo(points[0].x, points[0].y);

		for (let i = 1; i < points.length; i++) {
			ctx.lineTo(points[i].x, points[i].y);
		}

		ctx.stroke();

		if (this.strokeDashArray) {
			ctx.setLineDash([]);
		}
	}

	private processSelection(): void {
		if (this._points.length < this.minSelectionPoints) return;

		const selectionPolygon = new fabric.Polygon(this._points, {
			canvas: this.canvas,
			fill: "transparent",
			stroke: this.color,
			strokeWidth: this.width,
		});

		const hitObjects: fabric.Object[] = [];

		for (const obj of this.canvas.getObjects()) {
			if (this.pixelWiseIntersects(selectionPolygon, obj)) {
				hitObjects.push(obj);
			}
		}

		if (hitObjects.length) {
			this.canvas.setActiveObject(
				new fabric.ActiveSelection(hitObjects, { canvas: this.canvas })
			);
		}

		this.canvas.requestRenderAll();
	}

	private pixelWiseIntersects(a: fabric.Object, b: fabric.Object): boolean {
		const r1 = a.getBoundingRect();
		const r2 = b.getBoundingRect();

		const left = Math.max(r1.left, r2.left);
		const top = Math.max(r1.top, r2.top);
		const right = Math.min(r1.left + r1.width, r2.left + r2.width);
		const bottom = Math.min(r1.top + r1.height, r2.top + r2.height);

		if (right <= left || bottom <= top) return false;

		const w = Math.ceil(right - left);
		const h = Math.ceil(bottom - top);

		this._cachedCanvas1.width = this._cachedCanvas2.width = w;
		this._cachedCanvas1.height = this._cachedCanvas2.height = h;

		this._cachedCtx1.clearRect(0, 0, w, h);
		this._cachedCtx2.clearRect(0, 0, w, h);

		this._cachedCtx1.translate(-left, -top);
		this._cachedCtx2.translate(-left, -top);
		a.render(this._cachedCtx1);
		b.render(this._cachedCtx2);

		const d1 = this._cachedCtx1.getImageData(0, 0, w, h).data;
		const d2 = this._cachedCtx2.getImageData(0, 0, w, h).data;

		this._cachedCtx1.setTransform(1, 0, 0, 1, 0, 0);
		this._cachedCtx2.setTransform(1, 0, 0, 1, 0, 0);

		for (let i = 3; i < d1.length; i += 4) {
			if (d1[i] !== 0 && d2[i] !== 0) return true;
		}
		return false;
	}
}

export class EraserBrush extends IBaseBrush {
	public isEraser: boolean = true;
	private objectsToErase: fabric.Object[] = [];
	private _points: fabric.Point[] = [];
	private _color: string;
	private _cachedCanvas1: HTMLCanvasElement;
	private _cachedCanvas2: HTMLCanvasElement;
	private _cachedCtx1: CanvasRenderingContext2D;
	private _cachedCtx2: CanvasRenderingContext2D;

	constructor(canvas: ICanvas, width: number) {
		super(canvas);
		this._color = (canvas.backgroundColor as string)!;
		this.width = width;

		this._cachedCanvas1 = document.createElement("canvas");
		this._cachedCanvas2 = document.createElement("canvas");
		this._cachedCtx1 = this._cachedCanvas1.getContext("2d", {
			willReadFrequently: true,
		})!;
		this._cachedCtx2 = this._cachedCanvas2.getContext("2d", {
			willReadFrequently: true,
		})!;
	}

	onMouseDown(pointer: fabric.Point, options: any) {
		this.objectsToErase = [];
		this._points = [new fabric.Point(pointer.x, pointer.y)];

		this._saveAndTransform(this.canvas.contextTop);
		this._render(this.canvas.contextTop);
	}

	onMouseMove(pointer: fabric.Point, options: any) {
		if (this._points.length > 0) {
			this._points.push(new fabric.Point(pointer.x, pointer.y));
			this._render(this.canvas.contextTop);
		}
	}

	onMouseUp(options: fabric.TEvent<fabric.TPointerEvent>): boolean {
		this.canvas.asBatchedOperation((canvas) => {
			this.checkIntersections();
			this.eraseIntersectedObjects();

			canvas.clearContext(canvas.contextTop);
			canvas.contextTop.restore();
		});

		this._points = [];
		return false;
	}

	public _render(ctx: CanvasRenderingContext2D = this.canvas.contextTop) {
		const points = this._points;
		if (!points || points.length < 2) return;

		ctx.strokeStyle = this._color;
		ctx.lineWidth = this.width;

		ctx.beginPath();
		ctx.moveTo(points[0].x, points[0].y);
		for (let i = 1; i < points.length; i++) {
			ctx.lineTo(points[i].x, points[i].y);
		}
		ctx.stroke();
	}

	private checkIntersections() {
		if (this._points.length < 2) return;

		const eraserPathData = fabric.util.getSmoothPathFromPoints(
			this._points
		);
		const eraserPath = new fabric.Path(eraserPathData, {
			canvas: this.canvas,
			fill: "transparent",
			stroke: this._color,
			strokeWidth: this.width,
			strokeLineCap: "round",
		});

		for (const obj of this.canvas.getObjects()) {
			if (this.pixelWiseIntersects(eraserPath, obj)) {
				this.objectsToErase.push(obj);
			}
		}
	}

	private pixelWiseIntersects(a: fabric.Object, b: fabric.Object): boolean {
		const r1 = a.getBoundingRect();
		const r2 = b.getBoundingRect();

		const left = Math.max(r1.left, r2.left);
		const top = Math.max(r1.top, r2.top);
		const right = Math.min(r1.left + r1.width, r2.left + r2.width);
		const bottom = Math.min(r1.top + r1.height, r2.top + r2.height);

		if (right <= left || bottom <= top) return false;

		const w = Math.ceil(right - left);
		const h = Math.ceil(bottom - top);

		this._cachedCanvas1.width = this._cachedCanvas2.width = w;
		this._cachedCanvas1.height = this._cachedCanvas2.height = h;

		this._cachedCtx1.clearRect(0, 0, w, h);
		this._cachedCtx2.clearRect(0, 0, w, h);

		this._cachedCtx1.translate(-left, -top);
		this._cachedCtx2.translate(-left, -top);
		a.render(this._cachedCtx1);
		b.render(this._cachedCtx2);

		const d1 = this._cachedCtx1.getImageData(0, 0, w, h).data;
		const d2 = this._cachedCtx2.getImageData(0, 0, w, h).data;

		this._cachedCtx1.setTransform(1, 0, 0, 1, 0, 0);
		this._cachedCtx2.setTransform(1, 0, 0, 1, 0, 0);

		for (let i = 3; i < d1.length; i += 4) {
			if (d1[i] !== 0 && d2[i] !== 0) return true;
		}
		return false;
	}

	private eraseIntersectedObjects() {
		if (this.objectsToErase.length === 0) return;

		const canvas = this.canvas;
		this.objectsToErase.forEach((obj) => canvas.remove(obj));
		this.objectsToErase = [];

		canvas.requestRenderAll();
	}
}

export class HighlighterBrush extends IPencilBrush {
	constructor(canvas: ICanvas) {
		super(canvas);
		this.color = "rgba(255, 255, 0, 0.3)";
		this.decimate = 0;
	}
}

export class DefaultBrush extends IPencilBrush {
	constructor(canvas: ICanvas, color: string, width: number) {
		super(canvas);
		this.color = color;
		this.width = width;
		this.decimate = 0;
		this.strokeLineCap = "round";
	}
}

export class PerfectFreehandBrush extends IPencilBrush {
	freehandOptions: StrokeOptions;

	constructor(canvas: ICanvas, color: string, width: number) {
		super(canvas);

		this.color = color;
		this.width = width;
		this.decimate = 0;

		this.freehandOptions = {
			size: this.width,
			thinning: 0.5,
			smoothing: 0.8,
			streamline: 0.3,
			last: true,
		};
	}

	public setWidth(width: number): void {
		this.freehandOptions.size = width;
	}

	needsFullRender(): boolean {
		return true;
	}

	_render(ctx: CanvasRenderingContext2D = this.canvas.contextTop) {
		const points = this._points;
		if (!points || points.length < 2) return;

		this._saveAndTransform(ctx);

		const inputPoints = points.map((p) => [
			p.x,
			p.y,
			(p as any).pressure || 1,
		]);

		const stroke = getStroke(inputPoints, this.freehandOptions);

		if (!stroke || stroke.length < 2) {
			ctx.restore();
			return;
		}

		const freehandPoints = stroke.map(
			(point) => new fabric.Point(point[0], point[1])
		);

		const svgPath = this.convertPointsToSVGPath(freehandPoints);

		const path = new fabric.Path(svgPath, {
			fill: this.color,
			stroke: null,
			strokeWidth: 0,
			opacity: 1,
			originX: "center",
			originY: "center",
			objectCaching: true,
		});

		path.render(ctx);

		ctx.restore();
	}

	createPath(pathData: fabric.TSimplePathData): fabric.Path {
		const inputPoints = this._points.map((p) => [
			p.x,
			p.y,
			(p as any).pressure || 1,
		]);

		const stroke = getStroke(inputPoints, this.freehandOptions);

		const freehandPoints = stroke.map(
			(point) => new fabric.Point(point[0], point[1])
		);

		const svgPath = this.convertPointsToSVGPath(freehandPoints);

		return new fabric.Path(svgPath, {
			fill: this.color,
			stroke: null,
			strokeWidth: 0,
			opacity: 1,
			originX: "center",
			originY: "center",
			objectCaching: true,
		});
	}
}
export enum SizeTypeConstant {
	Small = "small",
	Medium = "medium",
	Large = "large",
}

export const BRUSH_SIZES = {
	SMALL: { name: SizeTypeConstant.Small, width: 2, title: "Small (2px)" },
	MEDIUM: { name: SizeTypeConstant.Medium, width: 6, title: "Medium (6px)" },
	LARGE: { name: SizeTypeConstant.Large, width: 12, title: "Large (12px)" },
};
