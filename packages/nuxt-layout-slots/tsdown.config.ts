import { defineConfig } from "tsdown";

export default defineConfig([{
    entry: [
        "src/components/*.ts",
        "src/module.ts",
    ],
    deps: {
        neverBundle: [
            /#build\/.*/,
            "@nuxt/schema",
            "vue",
        ],
    },
}, {
    entry: "src/language.ts",
    format: "cjs",
    deps: {
        neverBundle: [
            "@vue/language-core",
        ],
    },
}]);
