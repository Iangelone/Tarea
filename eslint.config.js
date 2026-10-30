import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "data/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["src/**/*.ts"], languageOptions: { globals: globals.node } },
  { files: ["public/**/*.js"], languageOptions: { globals: globals.browser } },
  { files: ["eslint.config.js"], languageOptions: { globals: globals.node } },
  prettier,
);
