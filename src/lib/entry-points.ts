import { join } from "path";
import { cwd } from "process";
import { confirm, text } from "@clack/prompts";
import arrgv from "arrgv";
import type { Options } from "tsup";
import { ensureNotCancelled, tasks } from "./clack";
import { defaultTsupConfig, getEntrypointPackageJson } from "./templates";
import { getPackageJson, touch, writePackageJson } from "./util";

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

export async function promptEntrypoints(proceed = false) {
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
    await tasks([
      {
        title: `Adding entry points: ${split.join(", ")}`,
        async task() {
          for (const entrypoint of split) {
            await addEntrypoint(entrypoint);
          }
        },
        getError() {
          return "Failed to add entry points";
        },
      },
    ]);
    await promptEntrypoints();
  }
}
