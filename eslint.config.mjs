import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

// eslint-plugin-react is intentionally NOT used here: its latest published release
// (7.37.5) calls an ESLint internal API removed in ESLint 10 and crashes on this
// project's real code (`contextOrFilename.getFilename is not a function`), confirmed
// empirically rather than assumed from its peer-range warning. react-hooks (the more
// consequential plugin for real bugs) and react-refresh are both confirmed compatible.
// Revisit adding it back once it ships ESLint 10 support.

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/*.tsbuildinfo",
      "**/src/generated/**",
      "prisma/generated/**",
      "**/coverage/**",
      "pnpm-lock.yaml",
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  // apps/api — Node/Express, server-only code, never bundled to the browser.
  {
    files: ["apps/api/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },

  // packages/shared — pure TS, no runtime environment assumptions.
  {
    files: ["packages/shared/**/*.ts"],
  },

  // apps/web — React SPA running in the browser.
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
    },
  },

  // Common project-quality rules, applied to all TypeScript across the workspace.
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-unused-vars": "off", // superseded by the TypeScript-aware rule above
    },
  },

  // Disables ESLint stylistic rules that would otherwise conflict with Prettier.
  eslintConfigPrettier,
);
