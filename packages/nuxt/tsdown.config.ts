import { defineConfig } from "tsdown";

export default defineConfig([{
    entry: {
        module: "src/module/index.ts",
    },
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
