/// <reference types="@volar/typescript" />

import { Buffer } from "node:buffer";
import { relative, resolve } from "pathe";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import type { Language } from "@volar/language-core";

describe("playground", () => {
    const logger: ts.server.Logger = {
        close: () => {},
        endGroup: () => {},
        getLogFileName: () => void 0,
        hasLevel: () => false,
        info: () => {},
        loggingEnabled: () => false,
        msg: () => {},
        perftrc: () => {},
        startGroup: () => {},
    };

    const session = new ts.server.Session({
        byteLength: Buffer.byteLength,
        cancellationToken: ts.server.nullCancellationToken,
        canUseEvents: true,
        host: ts.sys as any,
        hrtime: process.hrtime,
        logger,
        useInferredProjectPerProjectRoot: false,
        useSingleInferredProject: false,
    });

    const projectService = new ts.server.ProjectService({
        cancellationToken: ts.server.nullCancellationToken,
        globalPlugins: [
            "@vue/typescript-plugin",
        ],
        host: ts.sys as any,
        logger,
        session,
        useInferredProjectPerProjectRoot: false,
        useSingleInferredProject: false,
    });

    const playgroundRoot = resolve(import.meta.dirname, "../playground");
    const appVuePath = resolve(playgroundRoot, "app/app.vue");
    const buildDir = resolve(playgroundRoot, ".nuxt");
    projectService.openClientFile(appVuePath);

    const project = projectService.getDefaultProjectForFile(ts.server.toNormalizedPath(appVuePath), true)!;
    const languageService = project.getLanguageService();
    const program = languageService.getProgram()!;
    const language = (project as any).__vue__.language as Language<string>;

    const operationRE = /(?<=(?:\/\/|<!--)\s*)(?<range>\^—*\^)\((?<type>\w+)\)/;

    for (const fileName of project.getFileNames()) {
        if (fileName.startsWith(buildDir)) {
            continue;
        }

        const sourceFile = program.getSourceFile(fileName)!;
        const snapshot = language.scripts.get(fileName)?.snapshot;
        const sourceText = snapshot?.getText(0, snapshot.getLength()) ?? sourceFile.text;

        if (!operationRE.test(sourceText)) {
            continue;
        }

        const lines = sourceText.split("\n");
        const offsets = lines.reduce<number[]>((res, line, i) => {
            res.push(i ? res.at(-1)! + lines[i - 1].length + 1 : 0);
            return res;
        }, []);

        interface Item extends ts.TextSpan {
            type: string;
        }

        const items: Item[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(operationRE);
            if (!match) {
                continue;
            }

            const { range, type } = match.groups!;
            items.push({
                start: offsets[i - 1] + match.index!,
                length: range.length,
                type,
            });
        }

        describe(relative(playgroundRoot, fileName), () => {
            for (const { type, start, length } of items) {
                it(type, () => {
                    if (type === "definition") {
                        const result = languageService.getDefinitionAndBoundSpan?.(sourceFile.fileName, start);
                        expect(result).toBeDefined();
                        expect(result!.textSpan).toEqual({ start, length });
                        expect(
                            result!.definitions?.map((definition) => ({
                                fileName: relative(playgroundRoot, definition.fileName),
                                textSpan: definition.textSpan,
                            })),
                        ).toMatchSnapshot();
                    }
                    else if (type === "references") {
                        const result = languageService.findReferences(sourceFile.fileName, start);
                        expect(result).toBeDefined();
                        expect(result!.length).toBe(1);
                        expect(
                            result![0].references.map((reference) => ({
                                fileName: relative(playgroundRoot, reference.fileName),
                                textSpan: reference.textSpan,
                            })),
                        ).toMatchSnapshot();
                    }
                });
            }
        });
    }
});
