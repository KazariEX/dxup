import { ElementTypes, NodeTypes } from "@vue/compiler-dom";
import { genImport } from "knitwork";
import MagicString from "magic-string";
import { parseAndWalk } from "oxc-walker";
import { createUnplugin } from "unplugin";
import type { ObjectExpression, ParserOptions } from "oxc-parser";
import packageJson from "../../../package.json";
import { isInDir, isVue, parseSFC } from "./utils";

interface TransformPageOptions {
  dirs: string[];
  sourcemap: boolean;
}

export const TransformPagePlugin = (options: TransformPageOptions) => createUnplugin(() => ({
  name: packageJson.name + ":transform-page",
  enforce: "pre",
  transformInclude: isVue,
  transform(code, id) {
    if (!options.dirs.some((dir) => isInDir(id, dir))) {
      return;
    }

    const { scriptSetup, template } = parseSFC(code);
    if (!template) {
      return;
    }

    const slots: string[] = [];

    for (const node of template.children) {
      if (node.type !== NodeTypes.ELEMENT || node.tagType !== ElementTypes.TEMPLATE) {
        continue;
      }
      for (const prop of node.props) {
        if (
          prop.type === NodeTypes.DIRECTIVE &&
          prop.name === "slot" &&
          prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
          prop.arg.isStatic &&
          prop.arg.content !== "" &&
          prop.arg.content !== "default"
        ) {
          slots.push(prop.arg.content);
          break;
        }
      }
    }

    if (!slots.length) {
      return;
    }

    const s = new MagicString(code);
    const imports = genImport("#build/dxup/layouts.mjs", ["LayoutSlotsForward"]);
    const expression = `layoutSlots: [${slots.map((slot) => JSON.stringify(slot)).join(", ")}],\n`;

    if (scriptSetup) {
      let lang: ParserOptions["lang"] = "js";
      let meta: ObjectExpression | undefined;

      for (const prop of scriptSetup.props) {
        if (prop.type === NodeTypes.ATTRIBUTE && prop.name === "lang" && prop.value) {
          lang = prop.value.content as any;
          break;
        }
      }

      parseAndWalk(scriptSetup.innerLoc!.source, id, {
        parseOptions: {
          lang,
        },
        enter(node) {
          if (
            node.type === "CallExpression" &&
            node.callee.type === "Identifier" &&
            node.callee.name === "definePageMeta" &&
            node.arguments[0]?.type === "ObjectExpression"
          ) {
            meta = node.arguments[0];
            this.skip();
          }
        },
      });

      const start = scriptSetup.innerLoc!.start.offset;
      s.appendLeft(start, `\n${imports}\n`);

      if (meta) {
        s.appendLeft(meta.properties[0].start + start, expression);
      }
      else {
        s.appendLeft(scriptSetup.innerLoc!.start.offset, `\ndefinePageMeta({\n${expression}});\n`);
      }
    }
    else {
      s.prepend(`<script setup>\n${imports}\ndefinePageMeta({\n${expression}});\n</script>\n\n`);
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
}));
