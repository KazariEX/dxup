import { forEachTouchingNode } from "@dxup/shared";
import type ts from "typescript";
import { refactors } from "../shared";

export function getApplicableRefactors(
    ts: typeof import("typescript"),
    info: ts.server.PluginCreateInfo,
    getApplicableRefactors: ts.LanguageService["getApplicableRefactors"],
): ts.LanguageService["getApplicableRefactors"] {
    return (...args) => {
        const result = getApplicableRefactors(...args);

        const program = info.languageService.getProgram()!;
        const sourceFile = program.getSourceFile(args[0]);
        if (!sourceFile) {
            return result;
        }

        let node: ts.ParameterDeclaration | undefined;
        const position = typeof args[1] === "number" ? args[1] : args[1].pos;
        for (const child of forEachTouchingNode(ts, sourceFile, position)) {
            if (ts.isParameter(child)) {
                node = child;
            }
        }
        if (node?.parent.name) {
            result.push({
                name: "Dxup",
                description: "Dxup refactor actions",
                actions: [
                    refactors.rewrite.parameter.forward,
                    refactors.rewrite.parameter.backward,
                    refactors.rewrite.parameter.remove,
                ],
            });
        }

        return result;
    };
}
