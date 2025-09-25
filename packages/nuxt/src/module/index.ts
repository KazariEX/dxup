import { defineNuxtModule } from "@nuxt/kit";
import packageJson from "../../package.json";

export default defineNuxtModule({
    meta: {
        name: packageJson.name,
        configKey: "dxup",
    },
    async setup(options, nuxt) {
        const pluginsTs = [
            { name: "@dxup/nuxt" },
            { name: "@dxup/unimport" },
        ];

        const pluginsVue = [
            "@dxup/nuxt/vue/nitro-routes",
        ]

        append(pluginsTs, nuxt.options, "typescript", "tsConfig", "compilerOptions");
        append(pluginsTs, nuxt.options, "typescript", "sharedTsConfig", "compilerOptions");
        append(pluginsTs, nuxt.options.nitro, "typescript", "tsConfig", "compilerOptions");
        append(pluginsVue, nuxt.options, "typescript", "tsConfig", "vueCompilerOptions");
    },
});

function append<
    T extends Record<string, any>,
    K0 extends keyof T,
    K1 extends keyof NonNullable<T[K0]>,
    K2 extends keyof NonNullable<NonNullable<T[K0]>[K1]>,
>(plugins: any[], target: T, ...keys: [K0, K1?, K2?]) {
    for (const key of keys) {
        target = (target as any)[key] ??= {};
    }
    ((target as any).plugins ??= []).push(...plugins);
}
