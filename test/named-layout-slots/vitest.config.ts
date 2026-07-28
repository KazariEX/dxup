import { join } from "pathe";
import { defineProject } from "vitest/config";

export default defineProject({
  define: {
    "import.meta.server": true,
  },
  resolve: {
    alias: {
      "#build/dxup/layouts.mjs": join(import.meta.dirname, "stubs/layouts.ts"),
    },
  },
});
