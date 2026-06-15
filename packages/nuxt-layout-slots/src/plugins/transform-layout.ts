import { type ElementNode, NodeTypes } from "@vue/compiler-dom";
import { genImport } from "knitwork";
import MagicString from "magic-string";
import { createUnplugin } from "unplugin";
import packageJson from "../../package.json";
import { isVue, parseSFC } from "../utils";

interface TransformLayoutOptions {
  sourcemap: boolean;
}

export const TransformLayoutPlugin = (options: TransformLayoutOptions) => createUnplugin(() => ({
  name: packageJson.name + ":transform-layout",
  enforce: "pre",
  transformInclude: isVue,
  transform: {
    filter: {
      code: /<(?:nuxt-layout|NuxtLayout)/,
    },
    handler(code) {
      const { scriptSetup, template } = parseSFC(code);

      const layout = template?.children.find((node): node is ElementNode => (
        node.type === NodeTypes.ELEMENT && (
          node.tag === "nuxt-layout" || node.tag === "NuxtLayout"
        )
      ));

      if (!layout?.children.length) {
        return;
      }

      const s = new MagicString(code);

      const prefix = "\n" + genImport("#build/dxup/layouts.mjs", ["LayoutSlotsSymbol"]);
      const suffix = `
const __dxup_layoutSlots = shallowRef({});
provide(LayoutSlotsSymbol, __dxup_layoutSlots);\n`;

      if (scriptSetup) {
        s.appendLeft(scriptSetup.innerLoc!.start.offset, prefix);
        s.appendLeft(scriptSetup.innerLoc!.end.offset, suffix);
      }
      else {
        s.prepend(`<script setup>${prefix + suffix}</script>\n\n`);
      }

      s.appendLeft(
        layout.children.at(-1)!.loc.end.offset,
        `
<template v-for="name in $route.meta.layoutSlots ?? []" :key="name" #[name]="props">
    <component :is="() => __dxup_layoutSlots[name]?.(props)"/>
</template>`,
      );

      return {
        code: s.toString(),
        map: options.sourcemap
          ? s.generateMap({ hires: true })
          : void 0,
      };
    },
  },
}));
