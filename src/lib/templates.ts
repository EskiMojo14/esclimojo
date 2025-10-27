import { access, constants, readFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";
import { confirm } from "@clack/prompts";
import picocolors from "picocolors";
import type { Options } from "tsdown";
import type { PackageJson } from "type-fest";
import { __dirname } from "../constants";
import { ensureNotCancelled, tasks } from "./clack";
import { touch } from "./fs";
import type { SupportedManager } from "./package-managers";

export const defaultTsdownConfig = {
  entry: ["src/index.ts"],
  sourcemap: true,
  format: ["esm", "cjs"],
  dts: true,
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

interface CopyTemplateOptions {
  promptBeforeOverwrite?: boolean;
  react?: boolean;
  packageManager?: SupportedManager;
}

function removeBlock(content: string, block: string, strip: boolean): string {
  // happy path
  if (!content.includes(`/* ${block}:start`)) return content;

  const start = `\\n\\s*\\/\\* ${block}:start`;
  const end = `\\n\\s*${block}:end \\*\\/`;
  return content.replace(
    strip
      ? // remove the entire block
        new RegExp(start + ".*?" + end, "gs")
      : // uncomment the block
        new RegExp(start + "|" + end, "g"),
    ""
  );
}

export async function copyTemplate(
  template: string,
  {
    promptBeforeOverwrite = true,
    react = false,
    packageManager,
  }: CopyTemplateOptions = {}
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
          const contents = await readFile(source, { encoding: "utf-8" });

          await touch(
            join(cwd(), template),
            removeBlock(contents, "react", !react)
          );
          return `${
            templateType ? templateType + "t" : "T"
          }emplate ${picocolors.green(`"${template}"`)} copied`;
        },
        getError(e) {
          console.error(e);
          return (
            `Failed to copy ${templateType}template: ` +
            picocolors.red(`"${template}"`)
          );
        },
      },
    ]);
  }
}
