import { access, constants, copyFile } from "fs/promises";
import { join } from "path";
import { cwd } from "process";
import { confirm } from "@clack/prompts";
import picocolors from "picocolors";
import type { Options } from "tsup";
import type { PackageJson } from "type-fest";
import { __dirname } from "../constants";
import { ensureNotCancelled, tasks } from "./clack";

export const defaultTsupConfig: Options = {
  entry: ["src/index.ts"],
  sourcemap: true,
  format: ["esm", "cjs"],
  dts: true,
  minify: true,
};

/**
 * Generate the individual package.json files used
 */
export function getEntrypointPackageJson(
  parentName = "",
  version = "1.0.0",
  entrypoint: string
): PackageJson {
  return {
    name: parentName + `-${entrypoint}`,
    version: version,
    type: "module",
    main: `../dist/${entrypoint}.cjs`,
    module: `../dist/${entrypoint}.js`,
    types: `../dist/${entrypoint}.d.ts`,
    files: ["../dist"],
  };
}

export async function copyTemplate(
  template: string,
  promptBeforeOverwrite = true
) {
  let approved = !promptBeforeOverwrite;
  if (!approved) {
    let fileAlreadyExists = false;
    try {
      await access(join(cwd(), template), constants.F_OK);
      fileAlreadyExists = true;
    } catch {
      // file doesn't exist
    }
    if (fileAlreadyExists) {
      const overwrite = await confirm({
        message: `File "${template}" already exists, overwrite?`,
      });
      ensureNotCancelled(overwrite);
      approved = overwrite;
    } else {
      approved = true;
    }
  }
  if (approved) {
    await tasks([
      {
        title: "Copying template: " + picocolors.yellow(`"${template}"`),
        async task() {
          await copyFile(
            join(__dirname, "templates", template),
            join(cwd(), template)
          );
          return `Template ${picocolors.green(`"${template}"`)} copied`;
        },
        getError() {
          return "Failed to copy template: " + picocolors.red(`"${template}"`);
        },
      },
    ]);
  }
}
