/**
 * Plugin data structure types
 */

import type { CardState } from "./flashcard.types";
import type { OcclusionShape } from "./occlusion.types";

export interface NoteData {
	cards: Record<string, CardState>;
	data: NoteMetadata;
}

export interface NoteMetadata {
	noteVisitLog: string[];
	occlusion?: OcclusionShape[];
	drawing?: DrawingData;
}

export interface DrawingData {
	[key: string]: any;
}

export type PluginNotes = Record<string, NoteData>;

export function isNoteData(obj: any): obj is NoteData {
	return (
		typeof obj === "object" &&
		obj !== null &&
		typeof obj.cards === "object" &&
		typeof obj.data === "object" &&
		Array.isArray(obj.data.noteVisitLog)
	);
}
