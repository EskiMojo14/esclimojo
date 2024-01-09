#! /usr/bin/env node
import childProcess from "child_process";
import { Option, program } from "commander";
import { name, version, description } from "../package.json";
import { array, object, optional, parse, picklist, string } from "valibot";
import type { PackageJson } from "type-fest";
import { cwd } from "process";
import { join } from "path";
import type { Options } from "tsup";
import {
  ensureNotCancelled,
  getPackageJson,
  safeAssign,
  touch,
  withSpinner,
  writePackageJson,
} from "./util";
import { confirm, select, spinner, text } from "@clack/prompts";
import { promisify } from "util";
import * as templates from "./templates";
import { copyFile, readdir } from "fs/promises";

const execFile = promisify(childProcess.execFile);

const packageManagers = {
  yarn: {
    init: {
      command: "init",
      args: {
        yes: "-y",
      },
    },
    install: {
      command: "add",
      args: {
        dev: "-D",
      },
    },
  },
  npm: {
    init: {
      command: "init",
      args: {
        yes: "-y",
      },
    },
    install: {
      command: "install",
      args: {
        dev: "-D",
      },
    },
  },
};

type SupportedManager = keyof typeof packageManagers;

const supportedManagers = Object.keys(
  packageManagers
) as Array<SupportedManager>;

program.name(name).version(version).description(description);

async function addEntrypoint(entrypoint: string) {
  const packageJson = await getPackageJson();

  const exp = (packageJson.exports ??= {});

  if (typeof exp !== "object" || Array.isArray(exp)) {
    throw new Error("exports must be object");
  }

  exp[`./${entrypoint}`] = {
    import: `./dist/${entrypoint}.js`,
    require: `./dist/${entrypoint}.cjs`,
  };

  const tsupConfig: Options = ((packageJson.tsup as Options | undefined) ??=
    templates.defaultTsupConfig);

  (packageJson.files ??= []).push(entrypoint);
  const entry = (tsupConfig.entry ??= []);
  const entryPath = `src/${entrypoint}.ts`;
  if (Array.isArray(entry)) {
    entry.push(entryPath);
  } else {
    entry[entrypoint] = entryPath;
  }

  await writePackageJson(
    templates.getEntrypointPackageJson(
      packageJson.name,
      packageJson.version,
      entrypoint
    ),
    join(cwd(), entrypoint)
  );

  await touch(join(cwd(), `src/${entrypoint}.ts`));

  await writePackageJson(packageJson);
}

async function promptEntrypoint(s = spinner(), proceed = false) {
  if (!proceed) {
    const confirmResult = await confirm({
      message: "Do you want to add any more entry points?",
    });
    ensureNotCancelled(confirmResult);
    proceed = confirmResult;
  }
  if (proceed) {
    const entrypoint = await text({
      message: "What is the entry point name?",
    });
    ensureNotCancelled(entrypoint);
    await withSpinner(() => addEntrypoint(entrypoint), s, {
      pending: `Adding entry point: ${entrypoint}`,
      fulfilled: `Added entry point: ${entrypoint}`,
      rejected: `Failed to add entry point: ${entrypoint}`,
    });
    await promptEntrypoint(s);
  }
}

const devDeps: Record<string, true | string> = {
  "@arethetypeswrong/cli": true,
  "@typescript-eslint/eslint-plugin": true,
  "@typescript-eslint/parser": true,
  eslint: true,
  "eslint-import-resolver-typescript": true,
  "eslint-plugin-import": true,
  "eslint-plugin-vitest": true,
  husky: true,
  "lint-staged": true,
  prettier: true,
  publint: true,
  tsup: true,
  typescript: true,
  vitest: true,
};

const depList = Object.entries(devDeps).map(
  ([name, version]) => name + (typeof version === "string" ? "@" + version : "")
);

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
    ).choices(Object.keys(packageManagers))
  )
  .option("-e, --entry-points <entrypoints...>", "extra entry points")
  .action(async (options: unknown) => {
    const templates = await readdir(join(__dirname, "templates"));
    for (const template of templates) {
      await copyFile(
        join(__dirname, "templates", template),
        join(cwd(), template)
      );
    }
    const s = spinner();
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

    await withSpinner(
      () =>
        execFile(packageManager!, [
          commands.install.command,
          commands.install.args.dev,
          ...depList,
        ]),
      s,
      {
        pending: "Installing dependencies",
        fulfilled: "Dependencies installed",
        rejected: "Failed to install dependencies",
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
          pending: "Adding entry points",
          fulfilled: "Entry points added",
          rejected: "Failed to add entry points",
        }
      );
    }

    await promptEntrypoint(s);
  });

program
  .command("add-entrypoints")
  .argument("[entrypoints...]")
  .action(async (args: unknown) => {
    const s = spinner();
    const entryPoints = parse(initOptionsSchema.entries.entryPoints, args);

    if (entryPoints?.length) {
      await withSpinner(
        async () => {
          for (const entrypoint of entryPoints) {
            await addEntrypoint(entrypoint);
          }
        },
        s,
        {
          pending: "Adding entry points",
          fulfilled: "Entry points added",
          rejected: "Failed to add entry points",
        }
      );

      await promptEntrypoint(s);
    } else {
      await promptEntrypoint(s, true);
    }
  });

program.parse();
