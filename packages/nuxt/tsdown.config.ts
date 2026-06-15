import { defineConfig } from "tsdown";

export default defineConfig([{
  entry: {
    module: "src/module/index.ts",
  },
  deps: {
    neverBundle: [
      "@nuxt/schema",
    ],
  },
}, {
  entry: {
    typescript: "src/typescript/index.ts",
  },
  format: "cjs",
  deps: {
    alwaysBundle: [
      "@dxup/shared",
    ],
  },
}]);
