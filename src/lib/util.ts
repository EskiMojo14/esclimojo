import type { NoInfer } from "../types/util";

export const safeAssign: <T>(target: T, sources: Partial<NoInfer<T>>) => T =
  Object.assign;
