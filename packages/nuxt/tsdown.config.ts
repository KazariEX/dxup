import { defineConfig } from "tsdown";

export default defineConfig([{
    entry: {
        module: "src/module/index.ts",
    },
    external: [
        "@nuxt/schema",
    ],
}, {
    entry: {
        typescript: "src/typescript/index.ts",
    },
    format: [
        "cjs",
    ],
    noExternal: [
        "@dxup/shared",
    ],
}]);
