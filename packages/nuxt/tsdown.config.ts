import { defineConfig } from "tsdown";

export default defineConfig({
    entry: {
        typescript: "src/typescript/index.ts",
        "vue/nitro-routes": "src/vue/nitro-routes.ts",
    },
    format: [
        "cjs",
    ],
    exports: true,
});
