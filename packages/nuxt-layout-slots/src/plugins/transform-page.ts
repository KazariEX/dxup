import { type AttributeNode, type DirectiveNode, type ElementNode, ElementTypes, NodeTypes, parse } from "@vue/compiler-dom";
import { genImport } from "knitwork";
import MagicString from "magic-string";
import { parseAndWalk } from "oxc-walker";
import { createUnplugin } from "unplugin";
import type { ObjectExpression } from "oxc-parser";
import packageJson from "../../package.json";
import { isVue } from "../utils";

interface TransformPageOptions {
    dirs: string[];
    sourcemap: boolean;
}

export const TransformPagePlugin = (options: TransformPageOptions) => createUnplugin(() => ({
    name: packageJson.name + ":transform-page",
    enforce: "pre",
    transformInclude: isVue,
    transform(code, id) {
        if (!options.dirs.some((dir) => id.startsWith(dir))) {
            return;
        }

        const sfc = parse(code, {
            parseMode: "sfc",
        });

        let scriptSetup: ElementNode | undefined;
        let template: ElementNode | undefined;

        for (const node of sfc.children) {
            if (node.type !== NodeTypes.ELEMENT) {
                continue;
            }
            if (
                node.tag === "script" && node.props.some((prop) => (
                    prop.type === NodeTypes.ATTRIBUTE && prop.name === "setup"
                ))
            ) {
                scriptSetup = node;
            }
            else if (node.tag === "template") {
                template = node;
            }
        }

        if (!scriptSetup || !template) {
            return;
        }

        const slots: string[] = [];

        for (const node of template.children) {
            if (node.type !== NodeTypes.ELEMENT || node.tagType !== ElementTypes.TEMPLATE) {
                continue;
            }
            const dir = node.props.find((prop): prop is DirectiveNode => (
                prop.type === NodeTypes.DIRECTIVE && prop.name === "slot"
            ));
            if (
                dir?.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
                dir.arg.isStatic &&
                dir.arg.content !== "" &&
                dir.arg.content !== "default"
            ) {
                slots.push(dir.arg.content);
            }
        }

        if (!slots.length) {
            return;
        }

        let meta: ObjectExpression | undefined;

        parseAndWalk(scriptSetup.innerLoc!.source, id, {
            parseOptions: {
                lang: scriptSetup.props.find((prop): prop is AttributeNode => (
                    prop.type === NodeTypes.ATTRIBUTE && prop.name === "lang"
                ))?.value?.content as any ?? "ts",
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

        const s = new MagicString(code);
        const imports = genImport("#build/dxup/layouts.mjs", ["LayoutSlotsForward"]);
        const expression = `layoutSlots: [${slots.map((slot) => JSON.stringify(slot)).join(", ")}],\n`;

        if (scriptSetup) {
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
