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
      "components/*": "src/module/named-layout-slots/components/*.ts",
    },
    deps: {
      neverBundle: [
        /^#build\//,
        "vue",
      ],
    },
  },
  {
    entry: {
      "languages/named-layout-slots": "src/module/named-layout-slots/language.ts",
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
      alwaysBundle: [
        "@dxup/shared",
      ],
      neverBundle: [
        "typescript",
      ],
    },
  },
]);
