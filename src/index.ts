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
  writePackageJson,
} from "./util";
import { confirm, select, spinner, text } from "@clack/prompts";

const packageManagers = {
  yarn: {
    init: {
      command: "init",
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
    },
    install: {
      command: "install",
      args: {
        dev: "-D",
      },
    },
  },
};

const supportedManagers = Object.keys(packageManagers) as Array<
  keyof typeof packageManagers
>;

const defaultTsupConfig = {
  entry: ["src/index.ts"],
  sourcemap: true,
  format: ["esm", "cjs"],
  dts: true,
  minify: true,
} satisfies Options;

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
    defaultTsupConfig);

  (packageJson.files ??= []).push(entrypoint);
  const entry = (tsupConfig.entry ??= []);
  const entryPath = `src/${entrypoint}.ts`;
  if (Array.isArray(entry)) {
    entry.push(entryPath);
  } else {
    entry[entrypoint] = entryPath;
  }
  const packagePath = join(cwd(), entrypoint);

  const individualPackageJson: PackageJson = {
    name: packageJson.name + `-${entrypoint}`,
    version: packageJson.version ?? "1.0.0",
    type: "module",
    main: `../dist/${entrypoint}.cjs`,
    module: `../dist/${entrypoint}.js`,
    types: `../dist/${entrypoint}.d.ts`,
    files: ["../dist"],
  };
  await writePackageJson(individualPackageJson, packagePath);

  await touch(join(cwd(), `src/${entrypoint}.ts`));

  await writePackageJson(packageJson);
}

async function promptEntrypoint(proceed = false) {
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
    const s = spinner();
    s.start(`Adding entry point: ${entrypoint}`);
    try {
      await addEntrypoint(entrypoint);
      s.stop(`Added entry point: ${entrypoint}`);
    } catch (e) {
      s.stop(`Failed to add entry point: ${entrypoint}`);
    }
    await promptEntrypoint();
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
    let { packageManager, entryPoints } = parse(initOptionsSchema, options);
    if (!packageManager) {
      const result = await select<
        Array<{ value: keyof typeof packageManagers }>,
        keyof typeof packageManagers
      >({
        message: "Choose a package manager",
        initialValue: "yarn",
        options: supportedManagers.map((value) => ({ value })),
      });
      ensureNotCancelled(result);
      packageManager = result;
    }
    const commands = packageManagers[packageManager];
    childProcess.execFileSync(packageManager, [commands.init.command], {
      stdio: "inherit",
    });

    const packageJson = await getPackageJson();

    delete packageJson.main;

    safeAssign(packageJson, {
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
      tsup: defaultTsupConfig,
    });

    await touch(join(cwd(), "src/index.ts"));

    await writePackageJson(packageJson);

    childProcess.execFileSync(
      packageManager,
      [commands.install.command, commands.install.args.dev, ...depList],
      {
        stdio: "inherit",
      }
    );

    if (entryPoints?.length) {
      const s = spinner();
      s.start("Adding entry points");
      try {
        for (const entrypoint of entryPoints) {
          await addEntrypoint(entrypoint);
        }
        s.stop("Entry points added");
      } catch (e) {
        s.stop("Failed to add entry points");
        throw e;
      }
    }

    await promptEntrypoint();
  });

program
  .command("add-entrypoints")
  .argument("[entrypoints...]")
  .action(async (args: unknown) => {
    const entryPoints = parse(initOptionsSchema.entries.entryPoints, args);

    if (entryPoints?.length) {
      const s = spinner();
      s.start("Adding entry points");
      try {
        for (const entrypoint of entryPoints) {
          await addEntrypoint(entrypoint);
        }
        s.stop("Entry points added");
      } catch (e) {
        s.stop("Failed to add entry points");
        throw e;
      }

      await promptEntrypoint();
    } else {
      await promptEntrypoint(true);
    }
  });

program.parse();
