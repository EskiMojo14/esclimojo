type DependencyMap = Record<string, true | string>;

export const devDeps: DependencyMap = {
  "@arethetypeswrong/cli": true,
  "@typescript-eslint/parser": true,
  eslint: true,
  "@eslint/js": true,
  "eslint-import-resolver-typescript": true,
  "eslint-plugin-import-x": true,
  "eslint-plugin-vitest": true,
  globals: true,
  husky: true,
  jiti: true,
  "lint-staged": true,
  prettier: true,
  publint: true,
  tsdown: true,
  typescript: true,
  "typescript-eslint": true,
  vitest: true,
};

export const deps: DependencyMap = {};

export function processDepMap(map: DependencyMap) {
  return Object.entries(map).map(
    ([name, version]) =>
      name + (typeof version === "string" ? "@" + version : "")
  );
}
