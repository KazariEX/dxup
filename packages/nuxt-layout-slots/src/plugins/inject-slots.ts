import { type ElementNode, ElementTypes, NodeTypes, parse } from "@vue/compiler-dom";
import MagicString from "magic-string";
import { createUnplugin } from "unplugin";
import packageJson from "../../package.json";
import { isVue } from "../utils";

interface InjectSlotsOptions {
    dirs: string[];
    sourcemap: boolean;
}

export const InjectSlotsPlugin = (options: InjectSlotsOptions) => createUnplugin(() => ({
    name: packageJson.name + ":inject-slots",
    enforce: "pre",
    transformInclude: isVue,
    transform(code, id) {
        if (!options.dirs.some((dir) => id.startsWith(dir))) {
            return;
        }

        const sfc = parse(code, {
            parseMode: "sfc",
        });

        const template = sfc.children.find((node): node is ElementNode => (
            node.type === NodeTypes.ELEMENT && node.tag === "template"
        ));

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
