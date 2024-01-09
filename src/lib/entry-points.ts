import { join } from "path";
import { defaultTsupConfig, getEntrypointPackageJson } from "./templates";
import {
  ensureNotCancelled,
  getPackageJson,
  touch,
  withSpinner,
  writePackageJson,
} from "./util";
import { cwd } from "process";
import type { Options } from "tsup";
import { confirm, spinner, text } from "@clack/prompts";
import arrgv from "arrgv";

export async function addEntrypoint(entrypoint: string) {
  const packageJson = await getPackageJson();

  const exp = (packageJson.exports ??= {});

  if (typeof exp !== "object" || Array.isArray(exp)) {
    throw new Error("exports must be object");
  }

  exp[`./${entrypoint}`] = {
    import: `./dist/${entrypoint}.js`,
    require: `./dist/${entrypoint}.cjs`,
  };

  const tsupConfig = ((packageJson.tsup as Options | undefined) ??=
    defaultTsupConfig);

  (packageJson.files ??= []).push(entrypoint);
  const entry = (tsupConfig.entry ??= []);
  const entryPath = `src/${entrypoint}.ts`;
  if (Array.isArray(entry)) {
    entry.push(entryPath);
  } else {
    entry[entrypoint] = entryPath;
  }

  await writePackageJson(
    getEntrypointPackageJson(packageJson.name, packageJson.version, entrypoint),
    join(cwd(), entrypoint)
  );

  await touch(join(cwd(), `src/${entrypoint}.ts`));

  await writePackageJson(packageJson);
}

export async function promptEntrypoints(s = spinner(), proceed = false) {
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
