import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { defineConfig } from "tsdown";

export default defineConfig({
    entry: {
        plugin: "../vanilla/src/index.ts",
    },
    format: "cjs",
    dts: false,
    plugins: [
        {
            name: "redirect",
            async buildStart() {
                const path = resolve(import.meta.dirname, "node_modules/@dxup/vanilla/index.js");
                await mkdir(dirname(path), { recursive: true });
                await writeFile(path, `module.exports = require("../../../dist/plugin.cjs");\n`);
            },
        },
    ],
});
