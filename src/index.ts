#! /usr/bin/env node
import childProcess from "child_process";
import { Option, program } from "commander";
import { version } from "../package.json";
import {
  array,
  nonOptional,
  object,
  optional,
  parse,
  picklist,
  string,
} from "valibot";
import type { PackageJson } from "type-fest";
import { readFileSync, writeFileSync } from "fs";
import { cwd } from "process";
import { join } from "path";
import type { Options } from "tsup";
import { safeAssign, touch } from "./util";

const packageManagers = {
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
};

const defaultTsupConfig = {
  entry: ["src/index.ts"],
  sourcemap: true,
  format: ["esm", "cjs"],
  dts: true,
  minify: true,
} satisfies Options;

program.name("esclimojo").version(version);

async function addEntrypoint(packageJson: PackageJson, entrypoint: string) {
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
  await touch(
    join(packagePath, "package.json"),
    JSON.stringify(individualPackageJson, undefined, 2),
    { encoding: "utf-8" }
  );
  await touch(join(cwd(), `src/${entrypoint}.ts`));
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
      Object.keys(packageManagers) as Array<keyof typeof packageManagers>,
      `Must be one of supported: ${Object.keys(packageManagers).join(", ")}`
    ),
    "yarn"
  ),
  entryPoints: optional(array(string())),
});

program
  .command("init")
  .addOption(
    new Option("-p, --package-manager <manager>", "package manager to use")
      .choices(Object.keys(packageManagers))
      .default("yarn")
  )
  .option("-e, --entry-points <entrypoints...>", "extra entry points")
  .action(async (options: unknown) => {
    const { packageManager, entryPoints = [] } = parse(
      initOptionsSchema,
      options
    );
    const commands = packageManagers[packageManager];
    childProcess.execFileSync(packageManager, [commands.init.command], {
      stdio: "inherit",
    });

    childProcess.execFileSync(
      packageManager,
      [commands.install.command, commands.install.args.dev, ...depList],
      {
        stdio: "inherit",
      }
    );

    const pkgJsonPath = join(cwd(), "package.json");

    const packageJson = JSON.parse(
      readFileSync(pkgJsonPath, { encoding: "utf-8" })
    ) as PackageJson;

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

    for (const entrypoint of entryPoints) {
      await addEntrypoint(packageJson, entrypoint);
    }

    writeFileSync(pkgJsonPath, JSON.stringify(packageJson, undefined, 2), {
      encoding: "utf-8",
    });
  });

program
  .command("add-entrypoints")
  .argument("<entrypoints...>")
  .action(async (args: unknown) => {
    const entryPoints = parse(
      nonOptional(initOptionsSchema.entries.entryPoints),
      args
    );

    const pkgJsonPath = join(cwd(), "package.json");

    const packageJson = JSON.parse(
      readFileSync(pkgJsonPath, { encoding: "utf-8" })
    ) as PackageJson;

    for (const entrypoint of entryPoints) {
      await addEntrypoint(packageJson, entrypoint);
    }

    writeFileSync(pkgJsonPath, JSON.stringify(packageJson, undefined, 2), {
      encoding: "utf-8",
    });
  });

program.parse();
