import { defineConfig } from "eslint/config";
import myPlugin from "@ota-meshi/eslint-plugin";
import tseslint from "typescript-eslint";
import markdown from "@eslint/markdown";
import prettier from "eslint-plugin-prettier";
import markdownPreferences from "eslint-plugin-markdown-preferences";

export default defineConfig([
  {
    plugins: {
      prettier,
    },
  },
  {
    files: [
      "js",
      "mjs",
      "cjs",
      "ts",
      "mts",
      "cts",
      "vue",
      "json",
      "yaml",
    ].flatMap((ext) => [`*.${ext}`, `**/*.${ext}`]),
    extends: [
      myPlugin.config({
        node: true,
        ts: true,
        eslintPlugin: true,
        packageJson: true,
        json: true,
        yaml: true,
        // md: true,
        prettier: true,
        vue3: true,
      }),
    ],
    rules: {
      complexity: "off",
      "func-style": "off",
      "n/file-extension-in-import": "off",
      "one-var": "off",
    },
  },
  {
    files: ["**/*.ts", "**/*.mts"],
    rules: {
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        {
          allowDefaultCaseForExhaustiveSwitch: false,
          considerDefaultExhaustiveForUnions: true,
          requireDefaultForNonUnion: true,
        },
      ],
      "default-case": "off",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "mdast",
              message: "Please use `src/language/ast-types.ts` instead.",
            },
            {
              name: "mdast-util-math",
              importNames: ["Math", "InlineMath"],
              message: "Please use `src/language/ast-types.ts` instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.{js,ts,mjc,mts,cjs,cts}"],
    rules: {
      "n/prefer-node-protocol": "error",
      "n/file-extension-in-import": ["error", "always"],
    },
    settings: {
      n: {
        typescriptExtensionMap: [],
      },
    },
  },
  {
    files: ["**/*.md", "*.md"].flatMap((pattern) => [
      `${pattern}/*.js`,
      `${pattern}/*.mjs`,
    ]),
    rules: {
      "n/no-missing-import": "off",
    },
  },
  {
    files: ["docs/.vitepress/**"].flatMap((pattern) => [
      `${pattern}/*.js`,
      `${pattern}/*.mjs`,
      `${pattern}/*.ts`,
      `${pattern}/*.mts`,
      `${pattern}/*.vue`,
    ]),
    rules: {
      "jsdoc/require-jsdoc": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",

      // なぜ有効になっているか不明。要調査
      "vue/no-v-model-argument": "off",
    },
  },
  {
    files: ["**/*.md", "*.md"],
    extends: [
      markdown.configs.recommended,
      markdownPreferences.configs.standard,
    ],
    language: "markdown-preferences/extended-syntax",
    rules: {
      "prettier/prettier": "error",
      "markdown/no-missing-link-fragments": "off",
      "markdown/no-multiple-h1": ["error", { frontmatterTitle: "" }],

      "markdown-preferences/max-len": "off", // 今は無効化します
      "markdown-preferences/heading-casing": [
        "error",
        {
          preserveWords: [
            "ast-token-store",
            "@ota-meshi/ast-token-store",
            "ota-meshi/ast-token-store",
            "ota-meshi",
            ...markdownPreferences.resources.defaultPreserveWords,
          ],
          ignorePatterns: [String.raw`/^markdown-preferences\//u`],
        },
      ],
      "markdown-preferences/table-header-casing": [
        "error",
        {
          ignorePatterns: ["ID", "RECOMMENDED"],
        },
      ],
    },
  },
  {
    files: ["docs/**/*.md"],
    rules: {
      "markdown-preferences/definitions-last": "off",
      "markdown-preferences/no-tabs": ["error", { ignoreCodeBlocks: ["*"] }],
    },
  },
  {
    files: [".github/ISSUE_TEMPLATE/*.md"],
    rules: {
      "prettier/prettier": "off",
      "markdown/no-missing-label-refs": "off",
    },
  },
  {
    files: ["CHANGELOG.md"],
    rules: {
      "markdown-preferences/definitions-last": "off",
      "markdown-preferences/prefer-link-reference-definitions": "off",
    },
  },
  {
    files: ["playground/**/*.{js,mjs,cjs,md}"],
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "n/no-unpublished-import": "off",
      "n/no-missing-import": "off",
      "markdown-preferences/prefer-linked-words": "off",
      "markdown-preferences/heading-casing": "off",
    },
  },
  {
    files: ["tests/fixtures/**/*.{js,mjs,cjs,ts,mts,cts,md}"],
    languageOptions: {
      parserOptions: {
        project: null,
      },
    },
    rules: {
      "prettier/prettier": "off",
      ...tseslint.configs.disableTypeChecked.rules,
      "jsdoc/require-jsdoc": "off",
      "no-undef": "off",
      "no-lone-blocks": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-shadow": "off",
      yoda: "off",
      "no-empty": "off",
      "no-self-compare": "off",
      radix: "off",
      "no-implicit-coercion": "off",
      "no-void": "off",
      "n/no-extraneous-import": "off",
      "n/no-extraneous-require": "off",
      "n/no-missing-require": "off",
      "n/file-extension-in-import": "off",
      "@typescript-eslint/no-require-imports": "off",
      "markdown/no-missing-label-refs": "off",
      "markdown/no-multiple-h1": "off",
      "markdown/fenced-code-language": "off",
      "markdown/no-unused-definitions": "off",
      "markdown/require-alt-text": "off",
      "markdown/no-empty-links": "off",
      "markdown/no-empty-images": "off",
      "markdown/no-empty-definitions": "off",
      "markdown/heading-increment": "off",
    },
  },
  {
    files: ["tests/fixtures/**/*ignore-format*.js"],
    rules: {
      "prettier/prettier": "off",
    },
  },
  {
    ignores: [
      ".nyc_output/",
      "coverage/",
      "node_modules/",
      "lib/",
      "src/rule-types.ts",
      "!.github/",
      "!.vscode/",
      "!.devcontainer/",
      "!docs/.vitepress/",
      "docs/.vitepress/cache/",
      "docs/.vitepress/build-system/shim/",
      "docs/.vitepress/dist/",
      ".changeset/",
      "playground/src/example.md",
    ],
  },
]);
