import { isCancel } from "@clack/prompts";
import type { ObjectEncodingOptions, WriteFileOptions } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { cwd } from "process";
import { PackageJson } from "type-fest";

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

export function ensureNotCancelled<T>(result: T | symbol): asserts result is T {
  if (isCancel(result)) {
    process.exit();
  }
}

export async function getPackageJson(dir = cwd()) {
  return JSON.parse(
    await readFile(join(dir, "package.json"), { encoding: "utf-8" })
  ) as PackageJson;
}

export async function writePackageJson(contents: PackageJson, dir = cwd()) {
  return touch(
    join(dir, "package.json"),
    JSON.stringify(contents, undefined, 2)
  );
}
