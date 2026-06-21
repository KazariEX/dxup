import { ElementTypes, NodeTypes, type SlotOutletNode } from "@vue/compiler-dom";
import { genImport } from "knitwork";
import MagicString from "magic-string";
import { createUnplugin } from "unplugin";
import packageJson from "../../../package.json";
import { forEachElementNode, isInDir, isVue, parseSFC } from "./utils";

interface TransformOptions {
  layoutDirs: string[];
  pageDirs: string[];
  sourcemap: boolean;
}

export const TransformPlugins = (options: TransformOptions) => createUnplugin(() => [
  {
    name: packageJson.name + ":transform-layout",
    enforce: "pre",
    transformInclude: isVue,
    transform(code, id) {
      if (!options.layoutDirs.some((dir) => isInDir(id, dir))) {
        return;
      }

      const { scriptSetup, template } = parseSFC(code);
      if (!template) {
        return;
      }

      const slots: SlotOutletNode[] = [];

      for (const node of forEachElementNode(template)) {
        if (
          node.tagType === ElementTypes.SLOT &&
          node.props.length &&
          node.props.every((prop) => (
            prop.name !== "name" ||
            prop.type !== NodeTypes.ATTRIBUTE ||
            prop.value && prop.value.content !== "default"
          ))
        ) {
          slots.push(node);
        }
      }

      if (!slots.length) {
        return;
      }

      const s = new MagicString(code);
      const imports = genImport("#build/dxup/layouts.mjs", ["LayoutSlot"]);

      if (scriptSetup) {
        const start = scriptSetup.innerLoc!.start.offset;
        s.appendLeft(start, `\n${imports}\n`);
      }
      else {
        s.prepend(`<script setup>\n${imports}\n</script>\n\n`);
      }

      for (const slot of slots) {
        for (const offset of new Set([
          slot.loc.start.offset + slot.loc.source.indexOf("slot"),
          slot.loc.start.offset + slot.loc.source.lastIndexOf("slot"),
        ])) {
          s.overwrite(offset, offset + "slot".length, "LayoutSlot");
        }
      }

      return {
        code: s.toString(),
        map: options.sourcemap
          ? s.generateMap({ hires: true })
          : void 0,
      };
    },
  },
  {
    name: packageJson.name + ":transform-page",
    enforce: "pre",
    transformInclude: isVue,
    transform(code, id) {
      if (!options.pageDirs.some((dir) => isInDir(id, dir))) {
        return;
      }

      const { scriptSetup, template } = parseSFC(code);
      if (!template) {
        return;
      }

      const s = new MagicString(code);
      const imports = genImport("#build/dxup/layouts.mjs", ["LayoutSlotsForward"]);

      if (scriptSetup) {
        const start = scriptSetup.innerLoc!.start.offset;
        s.appendLeft(start, `\n${imports}\n`);
      }
      else {
        s.prepend(`<script setup>\n${imports}\n</script>\n\n`);
      }

      s.appendLeft(template.innerLoc!.start.offset, `<LayoutSlotsForward>`);
      s.appendLeft(template.innerLoc!.end.offset, "</LayoutSlotsForward>");

      return {
        code: s.toString(),
        map: options.sourcemap
          ? s.generateMap({ hires: true })
          : void 0,
      };
    },
  },
]);
