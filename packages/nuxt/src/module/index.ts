import { defineNuxtModule } from "@nuxt/kit";
import packageJson from "../../package.json";

export default defineNuxtModule({
    meta: {
        name: packageJson.name,
        configKey: "dxup",
    },
    async setup(options, nuxt) {
        nuxt.hook("prepare:types", (options) => {
            ((options.tsConfig.compilerOptions ??= {}).plugins ??= []).push({
                name: "@dxup/nuxt",
            });
            ((options.tsConfig.vueCompilerOptions ??= {}).plugins ??= []).push(
                "@dxup/nuxt/vue/nitro-routes",
            );
        });
    },
});
