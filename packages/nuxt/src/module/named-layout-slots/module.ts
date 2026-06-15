import { addBuildPlugin, addTemplate, addTypeTemplate, createResolver } from "@nuxt/kit";
import { genExport, genInlineTypeImport, genObjectKey } from "knitwork";
import { join } from "pathe";
import type { Nuxt } from "@nuxt/schema";
import { TransformLayoutPlugin } from "./plugins/transform-layout";
import { TransformPagePlugin } from "./plugins/transform-page";

export function setup(nuxt: Nuxt, pluginsVue: any[]) {
  const resolver = createResolver(import.meta.url);
  const pageDirs = nuxt.options._layers.map((layer) => join(
    layer.config.srcDir,
    layer.config.dir?.pages ?? "pages",
  ));

  pluginsVue.push({
    name: "@dxup/nuxt/languages/named-layout-slots.cjs",
    options: {
      dirs: pageDirs,
    },
  });

  addTemplate({
    filename: "dxup/layouts.mjs",
    getContents() {
      return `
${genExport(resolver.resolve("components/forward"), [{
  name: "default",
  as: "LayoutSlotsForward",
}])}
export const LayoutSlotsSymbol = Symbol();
`.trimStart();
    },
  });

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

  addBuildPlugin(TransformPagePlugin({
    dirs: pageDirs,
    sourcemap: !!nuxt.options.sourcemap.client,
  }));

  addBuildPlugin(TransformLayoutPlugin({
    sourcemap: !!nuxt.options.sourcemap.client,
  }));
}
