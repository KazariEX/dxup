import { defineNuxtModule } from "@nuxt/kit";
import * as packageJson from "../../package.json";

interface Plugin {
    name: string;
    options?: Record<string, any>;
}

export interface ModuleOptions {
    nitroRoutes?: boolean;
    runtimeConfig?: boolean;
    unimport?: boolean;
}

export default defineNuxtModule<ModuleOptions>({
    meta: {
        name: packageJson.name,
        configKey: "dxup",
    },
    defaults: {
        nitroRoutes: true,
        runtimeConfig: true,
        unimport: true,
    },
    async setup(options, nuxt) {
        const pluginsTs: Plugin[] = [];
        const pluginsVue: string[] = [];

        pluginsTs.push({
            name: "@dxup/nuxt",
            options: {
                nitroRoutes: options.nitroRoutes,
                runtimeConfig: options.runtimeConfig,
            },
        });
        if (options.nitroRoutes) {
            pluginsVue.push("@dxup/nuxt/vue/nitro-routes");
        }
        if (options.unimport) {
            pluginsTs.push({ name: "@dxup/unimport" });
        }

        append(pluginsTs, nuxt.options, "typescript", "tsConfig", "compilerOptions");
        append(pluginsTs, nuxt.options.nitro, "typescript", "tsConfig", "compilerOptions");
        append(pluginsTs, nuxt.options, "typescript", "sharedTsConfig", "compilerOptions");
        append(pluginsTs, nuxt.options, "typescript", "nodeTsConfig", "compilerOptions");
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
