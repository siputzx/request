export type LiteralUnion<T extends U, U = string> = T | (U & Record<never, never>);

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

export type ObjectEntries<T> = { [K in keyof T]: [K, T[K]] }[keyof T][];
