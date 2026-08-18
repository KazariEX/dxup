import { defineVitestProject } from "@nuxt/test-utils/config";
import { join } from "pathe";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "default",
          include: ["test/*.test.ts"],
        },
      },
      {
        test: {
          name: "named-layout-slots",
          include: ["test/named-layout-slots/unit/*.test.ts"],
        },
        define: {
          "import.meta.server": true,
        },
        resolve: {
          alias: {
            "#build/dxup/layouts.mjs": join(import.meta.dirname, "test/named-layout-slots/unit/stubs/layouts.ts"),
          },
        },
      },
      await defineVitestProject({
        test: {
          name: "named-layout-slots-e2e",
          include: ["test/named-layout-slots/e2e/*.test.ts"],
          environment: "nuxt",
          environmentOptions: {
            nuxt: {
              rootDir: join(import.meta.dirname, "test/named-layout-slots/e2e/fixture"),
              domEnvironment: "happy-dom",
            },
          },
        },
      }),
    ],
  },
});
