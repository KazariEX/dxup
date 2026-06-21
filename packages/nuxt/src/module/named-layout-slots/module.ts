import { addBuildPlugin, addTemplate, addTypeTemplate, createResolver } from "@nuxt/kit";
import { genExport, genInlineTypeImport, genObjectKey } from "knitwork";
import { join, relative } from "pathe";
import type { Nuxt } from "@nuxt/schema";
import { TransformPagePlugin } from "./transform";

export async function setup(nuxt: Nuxt, pluginsVue: any[]) {
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

  nuxt.hook("components:extend", (components) => {
    for (const comp of components) {
      if (comp.pascalName === "NuxtLayout") {
        comp.declarationPath = comp.filePath;
        comp.filePath = join(nuxt.options.buildDir, "dxup/layouts.mjs");
        break;
      }
    }
  });

  const layoutPath = join(
    await resolver.resolvePath("nuxt", { cwd: nuxt.options.rootDir }),
    "../app/components/nuxt-layout.js",
  );

  addTemplate({
    filename: "dxup/layouts.mjs",
    getContents() {
      return [
        genExport(resolver.resolve("runtime/layouts.mjs"), ["default", "LayoutSlotsForward"]),
        genExport(layoutPath, [{ name: "default", as: "NuxtLayout" }]),
      ].join("\n");
    },
  });

  addTypeTemplate({
    filename: "dxup/layouts.d.ts",
    getContents({ app }) {
      const currentDir = join(nuxt.options.buildDir, "dxup");
      return `
export interface Layouts {
${Object.values(app.layouts).map((layout) => (
  `  ${genObjectKey(layout.name)}: ${genInlineTypeImport(relative(currentDir, layout.file))};`
)).join("\n")}
}
`.trimStart();
    },
  });

  addBuildPlugin(TransformPagePlugin({
    dirs: pageDirs,
    sourcemap: !!nuxt.options.sourcemap.client,
  }));
}
