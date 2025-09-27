import { defineConfig } from "tsdown";

export default defineConfig([{
    entry: {
        module: "src/module/index.ts",
    },
}, {
    entry: {
        typescript: "src/typescript/index.ts",
        "vue/nitro-routes": "src/vue/nitro-routes.ts",
    },
    format: [
        "cjs",
    ],
    noExternal: [
        "@dxup/shared",
    ],
}]);
