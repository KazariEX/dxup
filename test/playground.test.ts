import { nextTick } from "node:process";
import { promisify } from "node:util";
import { relative, resolve } from "pathe";
import ts from "typescript";
import { describe, it } from "vitest";
import type { Language } from "@volar/language-core";
import { collectOperations, expectOperation, projectService } from "./shared";

describe("playground", async () => {
    const playgroundRoot = resolve(import.meta.dirname, "../playground");
    const appVuePath = resolve(playgroundRoot, "app/app.vue");
    const buildDir = resolve(playgroundRoot, ".nuxt");
    projectService.openClientFile(appVuePath);

    // wait for the postprocess of language service to complete
    await promisify(nextTick)();

    const project = projectService.getDefaultProjectForFile(ts.server.toNormalizedPath(appVuePath), true)!;
    const languageService = project.getLanguageService();
    const program = languageService.getProgram()!;
    const language = (project as any).__vue__.language as Language<string>;

    for (const fileName of project.getRootFiles()) {
        if (fileName.startsWith(buildDir)) {
            continue;
        }

        const sourceFile = program.getSourceFile(fileName)!;
        const snapshot = language.scripts.get(fileName)?.snapshot;
        const sourceText = snapshot?.getText(0, snapshot.getLength()) ?? sourceFile.text;

        const items = collectOperations(sourceText);
        if (!items.length) {
            continue;
        }

        describe(relative(playgroundRoot, fileName), () => {
            for (const item of items) {
                it(item.scope, () => {
                    expectOperation(languageService, playgroundRoot, sourceFile, item);
                });
            }
        });
    }
});
