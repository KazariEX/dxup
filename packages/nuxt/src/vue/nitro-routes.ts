import type { Code, VueLanguagePlugin } from "@vue/language-core";
import { forEachNode } from "../utils/ast";

const functionNames = new Set([
    "$fetch",
    "useFetch",
    "useLazyFetch",
]);

const plugin: VueLanguagePlugin = ({ modules: { typescript: ts } }) => {
    return {
        version: 2.2,
        resolveEmbeddedCode(fileName, sfc, embeddedFile) {
            if (!embeddedFile.id.startsWith("script_")) {
                return;
            }

            const { scriptSetup } = sfc;
            if (!scriptSetup) {
                return;
            }

            const codes: Code[] = [];
            for (const node of forEachNode(scriptSetup.ast)) {
                if (
                    ts.isCallExpression(node) &&
                    ts.isIdentifier(node.expression) &&
                    functionNames.has(node.expression.text) &&
                    node.arguments.length &&
                    ts.isStringLiteralLike(node.arguments[0])
                ) {
                    const arg = node.arguments[0];
                    codes.push(
                        `/** @type {__VLS_InternalApi[`,
                        [
                            arg.getText(scriptSetup!.ast),
                            sfc.scriptSetup!.name,
                            arg.getStart(scriptSetup!.ast),
                            {
                                navigation: true,
                            },
                        ],
                        `]} */;\n`,
                    );
                }
            }

            if (codes.length) {
                embeddedFile.content.push(
                    `import type { InternalApi as __VLS_InternalApi } from 'nitropack/types';\n`,
                    ...codes,
                );
            }
        },
    };
};

export default plugin;
