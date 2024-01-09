import { execFile as execFileAsync } from "child_process";
import { object, optional, picklist, array, string, parse } from "valibot";
import type { SupportedManager } from "../lib/package-managers";
import { packageManagers, supportedManagers } from "../lib/package-managers";
import { Option, program } from "commander";
import { intro, outro, select, spinner } from "@clack/prompts";
import {
  ensureNotCancelled,
  getPackageJson,
  safeAssign,
  touch,
  withSpinner,
  writePackageJson,
} from "../lib/util";
import { constants, copyFile, readdir } from "fs/promises";
import { join } from "path";
import { __dirname } from "../constants";
import { getLogger } from "../lib/logging";
import { cwd } from "process";
import color from "picocolors";
import { promisify } from "util";
import * as templates from "../lib/templates";
import type { PackageJson } from "type-fest";
import { deps, devDeps, processDepMap } from "../lib/deps";
import { addEntrypoint, promptEntrypoints } from "../lib/entry-points";

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
    const s = spinner();

    await withSpinner(
      async () => {
        const templates = await readdir(join(__dirname, "templates"));
        const logger = getLogger();
        for (const template of templates) {
          try {
            await copyFile(
              join(__dirname, "templates", template),
              join(cwd(), template),
              constants.COPYFILE_EXCL
            );
          } catch {
            logger.log(
              color.gray(
                `couldn't copy ${template}, assuming it already exists\n`
              )
            );
          }
        }
        logger.close();
      },
      s,
      {
        pending: "Copying templates",
        fulfilled: "Templates copied",
        rejected: "Failed to copy templates",
      }
    );

    await execFile("git", ["init"]);

    let { packageManager, entryPoints } = parse(initOptionsSchema, options);
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
      await withSpinner(
        () => execFile("yarn", ["set", "version", "stable"]),
        s,
        {
          pending: "Setting up Yarn",
          fulfilled: "Yarn successfully set up",
          rejected: "Failed to setup Yarn",
        }
      );
    }
    const commands = packageManagers[packageManager];
    await withSpinner(
      async () => {
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
      },
      s,
      {
        pending: "Initialising package.json",
        fulfilled: "package.json initialised",
        rejected: "Failed to initialise package.json",
      }
    );

    if (entryPoints?.length) {
      await withSpinner(
        async () => {
          for (const entrypoint of entryPoints!) {
            await addEntrypoint(entrypoint);
          }
        },
        s,
        {
          pending: `Adding entry points: ${entryPoints.join(", ")}`,
          fulfilled: "Entry points added",
          rejected: "Failed to add entry points",
        }
      );
    }

    await withSpinner(
      async () => {
        const depsProcessed = processDepMap(deps);
        if (depsProcessed.length) {
          await execFile(packageManager!, [
            commands.install.command,
            ...depsProcessed,
          ]);
        }
        const devDepsProcessed = processDepMap(devDeps);
        if (devDepsProcessed.length) {
          await execFile(packageManager!, [
            commands.install.command,
            commands.install.args.dev,
            ...devDepsProcessed,
          ]);
        }
      },
      s,
      {
        pending: "Installing dependencies",
        fulfilled: "Dependencies installed",
        rejected: "Failed to install dependencies",
      }
    );

    await promptEntrypoints(s);

    outro("All set up!");
  });