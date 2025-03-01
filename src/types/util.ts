import "@total-typescript/ts-reset";

export type NoInfer<T> = [T][T extends any ? 0 : never];
export type MaybePromise<T> = T | Promise<T>;
