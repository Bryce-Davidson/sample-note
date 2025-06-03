export interface CardState {
	cardUUID: string;
	cardContent: string;
	repetition: number;
	interval: number;
	ef: number;
	lastReviewDate: string;
	nextReviewDate: string;
	active: boolean;
	isLearning?: boolean;
	learningStep?: number;
	efHistory?: EfHistoryEntry[];
	cardTitle?: string;
	line?: number;
	createdAt: string;
	occlusionData?: OcclusionData;
	parentCardUUID?: string;
	hideGroupId?: string;
}

export interface EfHistoryEntry {
	timestamp: string;
	ef: number;
	rating: number;
}

export interface OcclusionData {
	mode: "HideAll" | "HideOne";
	shapeIds: string[];
}

export interface Flashcard {
	uuid: string;
	content: string;
	noteTitle?: string;
	filePath?: string;
	cardTitle?: string;
	line?: number;
	nextReviewDate?: string;
	ef?: number;
}

export interface CardMetadata {
	uuid: string;
	filePath: string;
	cardTitle?: string;
	nextReviewDate?: string;
	ef?: number;
	line?: number;
}

export function isCardState(obj: any): obj is CardState {
	return (
		typeof obj === "object" &&
		obj !== null &&
		typeof obj.cardUUID === "string" &&
		typeof obj.cardContent === "string" &&
		typeof obj.repetition === "number" &&
		typeof obj.interval === "number" &&
		typeof obj.ef === "number"
	);
}

export const DEFAULT_EF = 2.5;
export const MIN_EF = 1.3;
export const MAX_INTERVAL = 365;
