import type { ObjectEncodingOptions, WriteFileOptions } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";

type NoInfer<T> = [T][T extends any ? 0 : never];
export const safeAssign: <T>(target: T, sources: Partial<NoInfer<T>>) => T =
  Object.assign;

export async function touch(
  filepath: string,
  contents = "",
  options: Extract<WriteFileOptions, ObjectEncodingOptions> = {}
) {
  await mkdir(dirname(filepath), { recursive: true });
  return writeFile(filepath, contents, { encoding: "utf-8", ...options });
}
