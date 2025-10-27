import pluginJs from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import eslintPluginImportX from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";
import vitest from "eslint-plugin-vitest";
/* react:start
import pluginReact from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";
import react from "@eslint-react/eslint-plugin";
react:end */

export default tseslint.config(
  {
    ignores: ["eslint.config.mts", "dist"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
  },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      /* react:start
      react: { version: "detect" },
      react:end */
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  /* react:start
  // @ts-ignore
  pluginReact.configs.flat.recommended,
  // @ts-ignore
  pluginReact.configs.flat["jsx-runtime"],
  {
    ...react.configs["recommended-type-checked"],
    settings: {
      "react-x": {
        additionalHooks: {
          useLayoutEffect: ["useIsomorphicLayoutEffect"],
        },
        additionalComponents: [
          {
            name: "InternalLink",
            as: "a",
            attributes: [
              {
                name: "to",
                as: "href",
              },
              {
                name: "rel",
                defaultValue: "noopener noreferrer",
              },
            ],
          },
        ],
      },
    },
  },
  react:end */
  eslintPluginImportX.flatConfigs.recommended,
  eslintPluginImportX.flatConfigs.typescript,
  /* react:start
  {
    plugins: {
      "react-hooks": hooksPlugin,
    },
    rules: hooksPlugin.configs.recommended.rules,
  },
  react:end */
  {
    rules: {
      "@typescript-eslint/array-type": ["error", { default: "generic" }],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/only-throw-error": "off",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
      "import-x/order": [
        "error",
        {
          alphabetize: {
            order: "asc",
            orderImportKind: "asc",
            caseInsensitive: true,
          },
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
          ],
          pathGroups: [
            {
              pattern: "*.{css,scss}",
              patternOptions: { matchBase: true },
              group: "object",
              position: "after",
            },
            {
              pattern: "~/**",
              group: "internal",
            },
            {
              pattern: "react",
              group: "builtin",
              position: "before",
            },
            {
              pattern: "react-dom",
              group: "builtin",
              position: "before",
            },
          ],
          warnOnUnassignedImports: true,
        },
      ],
      /* react:start
      "react/prop-types": "off",
      "@eslint-react/no-forward-ref": "error",
      "@eslint-react/prefer-read-only-props": "off",
      react:end */
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "separate-type-imports" },
      ],
    },
  },
  {
    files: ["**/*.test.{js,mjs,cjs,ts,jsx,tsx}"],
    ...vitest.configs.recommended,
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/valid-title": ["error", { allowArguments: true }],
    },
  }
);
