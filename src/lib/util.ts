import type { NoInfer } from "../types/util";

export const safeAssign: <T>(target: T, sources: Partial<NoInfer<T>>) => T =
  Object.assign;

export const includes = <T>(arr: Array<T>, value: any): value is T =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  arr.includes(value);
