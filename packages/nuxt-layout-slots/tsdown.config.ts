import { defineConfig } from "tsdown";

export default defineConfig([{
    entry: {
        module: "src/module.ts",
    },
    deps: {
        neverBundle: [
            "@nuxt/schema",
        ],
    },
}, {
    entry: {
        language: "src/language.ts",
    },
    format: "cjs",
    deps: {
        neverBundle: [
            "@vue/language-core",
        ],
    },
}]);
