import { execFile as execFileAsync } from "child_process";
import { readdir } from "fs/promises";
import { join } from "path";
import { cwd } from "process";
import { promisify } from "util";
import { intro, outro, select } from "@clack/prompts";
import { Option, program } from "commander";
import type { PackageJson } from "type-fest";
import { object, optional, picklist, array, string, parse } from "valibot";
import { __dirname } from "../constants";
import { ensureNotCancelled, tasks } from "../lib/clack";
import { deps, devDeps, processDepMap } from "../lib/deps";
import { addEntrypoint, promptEntrypoints } from "../lib/entry-points";
import type { SupportedManager } from "../lib/package-managers";
import { packageManagers, supportedManagers } from "../lib/package-managers";
import * as templates from "../lib/templates";
import {
  getPackageJson,
  safeAssign,
  touch,
  writePackageJson,
} from "../lib/util";

const execFile = promisify(execFileAsync);

const initOptionsSchema = object({
  packageManager: optional(
    picklist(
      supportedManagers,
      `Must be one of supported: ${Object.keys(packageManagers).join(", ")}`
    )
  ),
  entryPoints: optional(array(string())),
});

program
  .command("init")
  .addOption(
    new Option(
      "-p, --package-manager <manager>",
      "package manager to use"
    ).choices(supportedManagers)
  )
  .option("-e, --entry-points <entrypoints...>", "extra entry points")
  .action(async (options: unknown) => {
    intro("Project initialisation");

    const allTemplates = await readdir(join(__dirname, "templates"));
    for (const template of allTemplates) {
      await templates.copyTemplate(template);
    }

    await execFile("git", ["init"]);

    let { packageManager, entryPoints = [] } = parse(
      initOptionsSchema,
      options
    );
    if (!packageManager) {
      const result = await select<
        Array<{ value: SupportedManager }>,
        SupportedManager
      >({
        message: "Choose a package manager",
        initialValue: "yarn",
        options: supportedManagers.map((value) => ({ value })),
      });
      ensureNotCancelled(result);
      packageManager = result;
    }
    if (packageManager === "yarn") {
      await touch(join(cwd(), "yarn.lock"));
      await tasks([
        {
          title: "Setting up Yarn",
          async task() {
            await execFile("yarn", ["set", "version", "stable"]);
            return "Yarn successfully set up";
          },
          getError() {
            return "Failed to setup Yarn";
          },
        },
      ]);
    }
    const commands = packageManagers[packageManager];
    await tasks([
      {
        title: "Initialising package.json",
        async task() {
          await execFile(packageManager!, [
            commands.init.command,
            commands.init.args.yes,
          ]);

          const packageJson = await getPackageJson();

          delete packageJson.main;

          safeAssign(packageJson, {
            version: packageJson.version ?? "1.0.0",
            type: "module",
            main: "./dist/index.cjs",
            module: "./dist/index.js",
            types: "./dist/index.d.ts",
            exports: {
              "./package.json": "./package.json",
              ".": {
                import: "./dist/index.js",
                require: "./dist/index.cjs",
              },
            },
            files: ["dist"],
            scripts: {
              prepare: "husky install",
              prebuild: "yarn type",
              build: "tsup",
              test: "vitest",
              lint: "eslint",
              format: "prettier",
              "pre-commit": "lint-staged",
              attw: "attw",
              publint: "publint",
              type: "tsc",
              prepack: "yarn publint",
            },
            prettier: {},
            "lint-staged": {
              "*.{ts,md}": "prettier --write",
            },
            tsup: templates.defaultTsupConfig as PackageJson[string],
          });

          await touch(join(cwd(), "src/index.ts"));

          await writePackageJson(packageJson);

          return "package.json initialised";
        },
        getError() {
          return "Failed to initialise package.json";
        },
      },
      {
        enabled: !!entryPoints.length,
        title: `Adding entry points: ${entryPoints.join(", ")}`,
        async task() {
          for (const entrypoint of entryPoints) {
            await addEntrypoint(entrypoint);
          }
          return "Entry points added";
        },
        getError() {
          return "Failed to add entry points";
        },
      },
      {
        title: "Installing dependencies",
        async task(message) {
          const depsProcessed = processDepMap(deps);
          if (depsProcessed.length) {
            await execFile(packageManager!, [
              commands.install.command,
              ...depsProcessed,
            ]);
            message("Dependencies installed");
          }
          const devDepsProcessed = processDepMap(devDeps);
          if (devDepsProcessed.length) {
            await execFile(packageManager!, [
              commands.install.command,
              commands.install.args.dev,
              ...devDepsProcessed,
            ]);
            message("Dev dependencies installed");
          }
          return "All dependencies installed";
        },
      },
    ]);

    await promptEntrypoints();

    outro("All set up!");
  });
