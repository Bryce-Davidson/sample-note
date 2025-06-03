import { writable } from "svelte/store";
import type { CardState } from "../types";

export type FlashcardEvent = {
	type: "card_reviewed";
	cardUUID: string;
	cardState: CardState;
};

const createFlashcardEventStore = () => {
	const { subscribe, set, update } = writable<FlashcardEvent | null>(null);

	return {
		subscribe,
		dispatchCardReviewed: (cardUUID: string, cardState: CardState) => {
			update(() => ({
				type: "card_reviewed",
				cardUUID,
				cardState,
			}));
		},
		reset: () => set(null),
	};
};

export const flashcardEventStore = createFlashcardEventStore();
