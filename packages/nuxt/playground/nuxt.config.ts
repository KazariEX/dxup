const runtimeConfig = {
    foo: {
        bar: 1,
    },
    public: {
        baz: 2,
    },
};

export default defineNuxtConfig({
    compatibilityDate: "2025-07-15",
    runtimeConfig,
    modules: [
        "@dxup/nuxt",
    ],
});
