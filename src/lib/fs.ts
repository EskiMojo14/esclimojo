import {
  lstatSync,
  type ObjectEncodingOptions,
  type WriteFileOptions,
} from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { cwd } from "process";
import type { PackageJson, TsConfigJson } from "type-fest";

export async function touch(
  filepath: string,
  contents = "",
  options: Extract<WriteFileOptions, ObjectEncodingOptions> = {}
) {
  await mkdir(dirname(filepath), { recursive: true });
  return writeFile(filepath, contents, { encoding: "utf-8", ...options });
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

export async function getTsconfig(dir = cwd()) {
  return JSON.parse(
    await readFile(join(dir, "tsconfig.json"), { encoding: "utf-8" })
  ) as TsConfigJson;
}

export async function writeTsconfig(contents: TsConfigJson, dir = cwd()) {
  return touch(
    join(dir, "tsconfig.json"),
    JSON.stringify(contents, undefined, 2)
  );
}

export function isFile(filename: string) {
  return lstatSync(filename).isFile();
}
