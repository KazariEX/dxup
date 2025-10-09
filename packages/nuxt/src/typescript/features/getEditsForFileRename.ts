import { forEachTouchingNode } from "@dxup/shared";
import type ts from "typescript";
import { toSourceSpan } from "../utils";
import type { ComponentReferenceInfo } from "../../event/types";
import type { Context } from "../types";

export function getEditsForFileRename(
    context: Context,
    getEditsForFileRename: ts.LanguageService["getEditsForFileRename"],
): ts.LanguageService["getEditsForFileRename"] {
    const { ts, info, data, server } = context;

    return (...args) => {
        const result = getEditsForFileRename(...args);
        if (!result?.length) {
            return result;
        }

        const program = info.languageService.getProgram()!;
        const references: Record<string, ComponentReferenceInfo[]> = {};

        for (const change of result) {
            const { fileName, textChanges } = change;

            if (data.components && fileName.endsWith("components.d.ts")) {
                const sourceFile = program.getSourceFile(fileName);
                if (!sourceFile) {
                    continue;
                }

                for (const { span } of textChanges) {
                    for (const node of forEachTouchingNode(ts, sourceFile, span.start)) {
                        if (!ts.isPropertySignature(node) && !ts.isVariableDeclaration(node)) {
                            continue;
                        }

                        const position = node.name.getStart(sourceFile);
                        const res = info.languageService.getReferencesAtPosition(fileName, position)
                            ?.filter((entry) => !entry.fileName.startsWith(data.buildDir));

                        const lazy = node.type &&
                            ts.isTypeReferenceNode(node.type) &&
                            ts.isIdentifier(node.type.typeName) &&
                            node.type.typeName.text === "LazyComponent";

                        for (const { fileName, textSpan } of res ?? []) {
                            (references[fileName] ??= []).push({
                                textSpan: toSourceSpan(context.language, fileName, textSpan) ?? textSpan,
                                lazy: lazy || void 0,
                            });
                        }
                        break;
                    }
                }
            }
        }

        if (Object.keys(references).length) {
            server.write("components:rename", {
                fileName: args[1],
                references,
            });
        }

        return result.filter((change) => {
            return !change.fileName.startsWith(data.buildDir);
        });
    };
}
