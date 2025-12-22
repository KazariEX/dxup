import { relative, resolve } from "pathe";
import ts from "typescript";
import { describe, it } from "vitest";
import { collectOperations, expectOperation, projectService } from "./shared";

describe("fixtures", () => {
    const fixturesRoot = resolve(import.meta.dirname, "fixtures");
    const signaturePath = resolve(fixturesRoot, "signature.ts");
    projectService.openClientFile(signaturePath);

    const project = projectService.getDefaultProjectForFile(ts.server.toNormalizedPath(signaturePath), true)!;
    const languageService = project.getLanguageService();
    const program = languageService.getProgram()!;

    for (const fileName of project.getRootFiles()) {
        const sourceFile = program.getSourceFile(fileName)!;

        const items = collectOperations(sourceFile.text);
        if (!items.length) {
            continue;
        }

        it(relative(fixturesRoot, fileName), () => {
            for (const { type, start, length } of items) {
                expectOperation(type, languageService, fixturesRoot, sourceFile, start, length);
            }
        });
    }
});
