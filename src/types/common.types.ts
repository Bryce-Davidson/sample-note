export type CardUUID = string & { readonly __brand: "CardUUID" };
export type FilePath = string & { readonly __brand: "FilePath" };
export type ISODateString = string & { readonly __brand: "ISODateString" };

export function createCardUUID(uuid: string): CardUUID {
	return uuid as CardUUID;
}

export function createFilePath(path: string): FilePath {
	return path as FilePath;
}

export function createISODateString(date: Date | string): ISODateString {
	const dateStr = typeof date === "string" ? date : date.toISOString();
	return dateStr as ISODateString;
}

export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepReadonly<T> = {
	readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Result<T, E = Error> =
	| { success: true; data: T }
	| { success: false; error: E };

export enum ReviewQuality {
	Again = 0,
	Hard = 1,
	Good = 3,
	Easy = 5,
}
