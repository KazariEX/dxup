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
      "test/layout-slots/vitest.config.ts",
    ],
  },
});
