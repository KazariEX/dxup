import { forEachTouchingNode } from "@dxup/shared";
import type ts from "typescript";
import type { ComponentReferenceInfo } from "../../event/types";
import type { Context } from "../types";

export function preprocess(
    context: Context,
    getEditsForFileRename: ts.LanguageService["getEditsForFileRename"],
): ts.LanguageService["getEditsForFileRename"] {
    const { ts, info, data, server } = context;

    return (...args) => {
        const result = getEditsForFileRename(...args);
        if (!result?.length) {
            return result;
        }

        if (data.features.components) {
            // use the language service proxied by volar for source offsets
            const languageService = info.project.getLanguageService();
            const program = languageService.getProgram()!;
            const references: Record<string, ComponentReferenceInfo[]> = {};

            for (const { fileName, textChanges } of result) {
                if (!fileName.endsWith("components.d.ts")) {
                    continue;
                }

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
                        const res = languageService.getReferencesAtPosition(fileName, position)
                            ?.filter((entry) => !entry.fileName.startsWith(data.buildDir))
                            ?.sort((a, b) => a.textSpan.start - b.textSpan.start);

                        const lazy = node.type &&
                            ts.isTypeReferenceNode(node.type) &&
                            ts.isIdentifier(node.type.typeName) &&
                            node.type.typeName.text === "LazyComponent";

                        for (const { fileName, textSpan } of res ?? []) {
                            (references[fileName] ??= []).push({
                                textSpan,
                                lazy: lazy || void 0,
                            });
                        }
                        break;
                    }
                }
            }

            if (Object.keys(references).length) {
                server.write("components:rename", {
                    fileName: args[1],
                    references,
                });
            }
        }

        return result.filter((change) => {
            return !change.fileName.startsWith(data.buildDir);
        });
    };
}
