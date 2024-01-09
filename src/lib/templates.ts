import type { Options } from "tsup";
import type { PackageJson } from "type-fest";

export const defaultTsupConfig: Options = {
  entry: ["src/index.ts"],
  sourcemap: true,
  format: ["esm", "cjs"],
  dts: true,
  minify: true,
};

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
