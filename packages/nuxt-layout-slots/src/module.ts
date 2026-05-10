import { addBuildPlugin, addTypeTemplate, defineNuxtModule } from "@nuxt/kit";
import { genInlineTypeImport, genObjectKey } from "knitwork";
import { join } from "pathe";
import packageJson from "../package.json";
import { createPlugin } from "./plugin";

export default defineNuxtModule({
    meta: {
        name: packageJson.name,
    },
    setup(options, nuxt) {
        const pagesDirs = nuxt.options._layers.map((layer) => join(
            layer.config.srcDir,
            layer.config.dir?.pages ?? "pages",
        ));

        const pluginsVue = [{
            name: "@dxup/nuxt-layout-slots/language",
            options: {
                dirs: pagesDirs,
            },
        }];

        append(pluginsVue, nuxt.options, "typescript", "tsConfig", "vueCompilerOptions");

        addTypeTemplate({
            filename: "dxup/layouts.d.ts",
            getContents({ app }) {
                return `
export interface Layouts {
${Object.values(app.layouts).map((layout) => (
    `    ${genObjectKey(layout.name)}: ${genInlineTypeImport(layout.file)};`
)).join("\n")}
}
`.trimStart();
            },
        });

        addBuildPlugin(createPlugin(pagesDirs, !!nuxt.options.sourcemap.client));
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
