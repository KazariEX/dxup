import { type ElementNode, ElementTypes, NodeTypes, parse } from "@vue/compiler-dom";
import MagicString from "magic-string";
import { parseAndWalk } from "oxc-walker";
import { createUnplugin } from "unplugin";
import type { ExpressionStatement, ObjectProperty } from "oxc-parser";
import packageJson from "../package.json";
import { isVue } from "./utils";

export const createPlugin = (pagesDirs: string[], sourcemap?: boolean) => createUnplugin(() => ({
    name: packageJson.name,
    enforce: "pre",
    transformInclude: isVue,
    transform(code, id) {
        if (!pagesDirs.some((dir) => id.startsWith(dir))) {
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

        if (
            !template?.children.some((node) => (
                node.type === NodeTypes.ELEMENT &&
                node.tagType === ElementTypes.TEMPLATE &&
                node.props.some((prop) => prop.type === NodeTypes.DIRECTIVE && prop.name === "slot")
            ))
        ) {
            return;
        }

        const s = new MagicString(code);
        let macroNode: ExpressionStatement | undefined;
        let layoutNode: ObjectProperty | undefined;

        if (scriptSetup?.innerLoc?.source.includes("definePageMeta")) {
            parseAndWalk(scriptSetup.innerLoc.source, id, {
                enter(node) {
                    if (
                        node.type !== "ExpressionStatement" ||
                        node.expression.type !== "CallExpression" ||
                        node.expression.callee.type !== "Identifier" ||
                        node.expression.callee.name !== "definePageMeta" ||
                        node.expression.arguments[0]?.type !== "ObjectExpression"
                    ) {
                        return;
                    }
                    macroNode = node;

                    for (const prop of node.expression.arguments[0].properties) {
                        if (
                            prop.type === "Property" &&
                            prop.key.type === "Identifier" &&
                            prop.key.name === "layout"
                        ) {
                            layoutNode = prop;
                            break;
                        }
                    }
                    this.skip();
                },
            });
        }

        if (macroNode && layoutNode) {
            const start = scriptSetup!.innerLoc!.start.offset;
            const valueStart = layoutNode.value.start + start;
            const valueEnd = layoutNode.value.end + start;
            const macroEnd = macroNode.end + start;

            s.appendLeft(macroEnd, "\nconst __nuxt_layout = ");
            s.appendRight(macroEnd, `;
const __nuxt_layout_name = typeof __nuxt_layout === "object" ? __nuxt_layout?.name : __nuxt_layout;
const __nuxt_layout_props = typeof __nuxt_layout === "object" ? __nuxt_layout?.props : void 0;`);
            s.move(valueStart, valueEnd, macroEnd);
            s.appendLeft(valueStart, "false");
        }

        s.appendLeft(template.innerLoc!.start.offset, `<NuxtLayout :name="__nuxt_layout_name" v-bind="__nuxt_layout_props">`);
        s.appendLeft(template.innerLoc!.end.offset, "</NuxtLayout>");

        return {
            code: s.toString(),
            map: sourcemap
                ? s.generateMap({ hires: true })
                : void 0,
        };
    },
}));
