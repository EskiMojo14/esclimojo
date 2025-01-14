import { access, constants, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";
import { confirm } from "@clack/prompts";
import picocolors from "picocolors";
import type { Options } from "tsup";
import type { PackageJson } from "type-fest";
import { __dirname } from "../constants";
import { ensureNotCancelled, tasks } from "./clack";
import { touch } from "./fs";
import type { SupportedManager } from "./package-managers";

export const defaultTsupConfig = {
  entry: ["src/index.ts"],
  sourcemap: true,
  format: ["esm", "cjs"],
  dts: true,
  minify: true,
} satisfies Options;

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
  promptBeforeOverwrite = true,
  packageManager?: SupportedManager
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
    const templateType = packageManager
      ? picocolors.bold(packageManager) + " "
      : "";
    await tasks([
      {
        title:
          `Copying ${templateType}template: ` +
          picocolors.yellow(`"${template}"`),
        async task() {
          const source = packageManager
            ? join(__dirname, "pm-templates", packageManager, template)
            : join(__dirname, "templates", template);
          const dest = join(cwd(), template);
          // touch first to ensure dir exists
          await touch(dest);
          await copyFile(source, dest);
          return `${
            templateType ? templateType + "t" : "T"
          }emplate ${picocolors.green(`"${template}"`)} copied`;
        },
        getError() {
          return (
            `Failed to copy ${templateType}template: ` +
            picocolors.red(`"${template}"`)
          );
        },
      },
    ]);
  }
}
