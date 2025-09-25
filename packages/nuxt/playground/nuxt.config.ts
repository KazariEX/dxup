export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  typescript: {
    tsConfig: {
        compilerOptions: {
            plugins: [
                { name: "@dxup/nuxt" },
            ],
        },
        vueCompilerOptions: {
            plugins: [
                "@dxup/nuxt/vue/nitro-routes",
            ],
        },
    },
  },
});
