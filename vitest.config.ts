import { join } from "pathe";
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    "import.meta.server": true,
  },
  resolve: {
    alias: {
      "#build/dxup/layouts.mjs": join(import.meta.dirname, "test/stubs/layouts.ts"),
    },
  },
});
