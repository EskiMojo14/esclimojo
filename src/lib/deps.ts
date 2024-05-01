type DependencyMap = Record<string, true | string>;

export const devDeps: DependencyMap = {
  "@arethetypeswrong/cli": true,
  "@typescript-eslint/eslint-plugin": true,
  "@typescript-eslint/parser": true,
  eslint: "^8",
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

export const deps: DependencyMap = {};

export function processDepMap(map: DependencyMap) {
  return Object.entries(map).map(
    ([name, version]) =>
      name + (typeof version === "string" ? "@" + version : "")
  );
}
