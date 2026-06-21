import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: {
      module: "src/module/index.ts",
    },
    deps: {
      neverBundle: [
        "@nuxt/schema",
      ],
    },
  },
  {
    entry: {
      "runtime/*": "src/module/named-layout-slots/runtime/**/*.ts",
    },
    deps: {
      neverBundle: [
        /^#(?:build|imports)(?:\/|$)/,
        "vue",
      ],
    },
  },
  {
    entry: {
      "languages/*": "src/module/*/language.ts",
    },
    outputOptions: {
      entryFileNames: ({ name }) => `${name.replace("/language", "")}.cjs`,
    },
    format: "cjs",
    deps: {
      neverBundle: [
        "@vue/language-core",
      ],
    },
  },
  {
    entry: {
      typescript: "src/typescript/index.ts",
    },
    format: "cjs",
    deps: {
      neverBundle: [
        "typescript",
      ],
    },
  },
]);
