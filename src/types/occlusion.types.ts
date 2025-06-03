/**
 * Occlusion-related types and interfaces
 */

export interface OcclusionShape {
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string;
	opacity: number;
	id?: string;
}

export interface OcclusionConfig {
	defaultFill: string;
	defaultOpacity: number;
	minWidth: number;
	minHeight: number;
}

export function isOcclusionShape(obj: any): obj is OcclusionShape {
	return (
		typeof obj === "object" &&
		obj !== null &&
		typeof obj.x === "number" &&
		typeof obj.y === "number" &&
		typeof obj.width === "number" &&
		typeof obj.height === "number" &&
		typeof obj.fill === "string" &&
		typeof obj.opacity === "number"
	);
}

export const DEFAULT_OCCLUSION_CONFIG: OcclusionConfig = {
	defaultFill: "#000000",
	defaultOpacity: 1,
	minWidth: 10,
	minHeight: 10,
};
