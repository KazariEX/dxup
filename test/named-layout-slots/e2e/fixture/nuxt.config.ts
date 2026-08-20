export default defineNuxtConfig({
  experimental: {
    // the nitro vite environment breaks inside the vitest dev server
    nitroViteEnvironment: false,
  },
  modules: ["@dxup/nuxt"],
  dxup: {
    features: {
      namedLayoutSlots: true,
    },
  },
});
