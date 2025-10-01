const runtimeConfig = {
    foo: {
        bar: 1,
        baz: 2,
        qux: 3,
    },
    public: {
        hello: 2333,
    },
};

export default defineNuxtConfig({
    compatibilityDate: "2025-07-15",
    runtimeConfig,
    modules: [
        "@dxup/nuxt",
    ],
});
