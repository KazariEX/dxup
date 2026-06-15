import { defineConfig } from "tsdown";

export default defineConfig({
  format: "cjs",
  exports: true,
  deps: {
    alwaysBundle: [
      "@dxup/shared",
    ],
  },
});
