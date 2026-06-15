import { type ElementNode, NodeTypes, parse } from "@vue/compiler-dom";

const vueRE = /[?&]vue(?:&|$)/;
const typeRE = /[?&]type=[^&]*/;

export function isVue(id: string) {
    const index = id.indexOf("?");
    const query = index !== -1 ? id.slice(index) : void 0;

    if (query === void 0) {
        return id.endsWith(".vue");
    }

    if (query === "?macro=true") {
        return true;
    }

    if (!vueRE.test(query)) {
        return false;
    }

    if (typeRE.test(query)) {
        return false;
    }

    return true;
}

export function parseSFC(code: string) {
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
                prop.type === NodeTypes.ATTRIBUTE && (prop.name === "setup" || prop.name === "vapor")
            ))
        ) {
            scriptSetup = node;
        }
        else if (node.tag === "template") {
            template = node;
        }
    }

    return {
        scriptSetup,
        template,
    };
}
