#! /usr/bin/env node
import childProcess from "child_process";
import { Option, program } from "commander";
import { name, version, description } from "../package.json";
import {
  array,
  boolean,
  object,
  optional,
  parse,
  picklist,
  string,
} from "valibot";
import type { PackageJson } from "type-fest";
import { cwd } from "process";
import { dirname, join } from "path";
import type { Options } from "tsup";
import {
  ensureNotCancelled,
  getPackageJson,
  safeAssign,
  touch,
  withSpinner,
  writePackageJson,
} from "./util";
import { confirm, intro, outro, select, spinner, text } from "@clack/prompts";
import { promisify } from "util";
import * as templates from "./templates";
import { constants, copyFile, readdir, access } from "fs/promises";
import color from "picocolors";
import { getLogger } from "./logging";
import { fileURLToPath } from "url";
import arrgv from "arrgv";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

async function promptEntrypoints(s = spinner(), proceed = false) {
  if (!proceed) {
    const confirmResult = await confirm({
      message: "Do you want to add any more entry points?",
    });
    ensureNotCancelled(confirmResult);
    proceed = confirmResult;
  }

  if (proceed) {
    const entrypoint = await text({
      message: "What are the entry point names?",
    });
    ensureNotCancelled(entrypoint);
    const split = arrgv(entrypoint);
    await withSpinner(
      async () => {
        for (const entrypoint of split) {
          await addEntrypoint(entrypoint);
        }
      },
      s,
      {
        pending: `Adding entry points: ${split.join(", ")}`,
        fulfilled: "Entry points added",
        rejected: "Failed to add entry points",
      }
    );
    await promptEntrypoints(s);
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

    await promptEntrypoints(s);

    outro("All set up!");
  });

program
  .command("add-entrypoints")
  .argument("[entrypoints...]")
  .action(async (args: unknown) => {
    intro("Add entry points");
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

      await promptEntrypoints(s);
    } else {
      await promptEntrypoints(s, true);
    }
    outro("All done!");
  });

const copyTemplateOptions = object({
  yes: optional(boolean()),
});

program
  .command("copy-template")
  .option("-y, --yes", "override existing file without asking")
  .argument("<filename>")
  .action(async (file, options) => {
    intro("Copy template");
    const filename = parse(string(), file);
    let { yes } = parse(copyTemplateOptions, options);
    try {
      await access(join(__dirname, "templates", filename), constants.R_OK);
    } catch (e) {
      program.error(`Template "${filename}" not found`);
    }
    if (!yes) {
      let fileAlreadyExists = false;
      try {
        await access(join(cwd(), filename), constants.F_OK);
        fileAlreadyExists = true;
      } catch {
        // file doesn't exist
      }
      if (fileAlreadyExists) {
        const overwrite = await confirm({
          message: "File already exists, overwrite?",
        });
        ensureNotCancelled(overwrite);
        yes = overwrite;
      }
    }
    if (yes) {
      await withSpinner(
        () =>
          copyFile(
            join(__dirname, "templates", filename),
            join(cwd(), filename)
          ),
        undefined,
        {
          pending: `Copying template: ${filename}`,
          fulfilled: `Template ${filename} copied`,
          rejected: `Failed to copy template: ${filename}`,
        }
      );
    }
    outro("Done");
  });

program.parse();
