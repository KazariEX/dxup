/// <reference types="@volar/typescript" />

import { Buffer } from "node:buffer";
import { relative, resolve } from "pathe";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import type { Language } from "@volar/language-core";

describe("playground", () => {
    const logger: ts.server.Logger = {
        close() {},
        endGroup() {},
        getLogFileName: () => void 0,
        hasLevel: () => false,
        info: () => {},
        loggingEnabled: () => false,
        msg: () => {},
        perftrc: () => {},
        startGroup: () => {},
    };

    const session = new ts.server.Session({
        byteLength: (buf, encoding) => Buffer.byteLength(buf, encoding),
        cancellationToken: ts.server.nullCancellationToken,
        canUseEvents: true,
        host: ts.sys as any,
        hrtime: (start) => process.hrtime(start),
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
    projectService.openClientFile(appVuePath);

    const project = projectService.getDefaultProjectForFile(ts.server.toNormalizedPath(appVuePath), true)!;
    const languageService = project.getLanguageService();
    const program = languageService.getProgram()!;
    const language = (project as any).__vue__.language as Language<string>;

    const sourceFile = program.getSourceFile(appVuePath)!;
    const sourceScript = language.scripts.get(appVuePath);
    const serviceScript = sourceScript?.generated!.languagePlugin.typescript?.getServiceScript(
        sourceScript.generated!.root,
    );
    const sourceText = sourceScript?.snapshot.getText(0, sourceScript.snapshot.getLength()) ?? sourceFile.text;

    function getSourceTextSpan(start: number, end: number) {
        if (sourceScript && serviceScript) {
            const map = language.maps.get(serviceScript.code, sourceScript);
            // eslint-disable-next-line no-unreachable-loop
            for (const range of map.toSourceRange(start - sourceText.length, end - sourceText.length, false)) {
                return {
                    start: range[0],
                    length: range[1] - range[0],
                };
            }
        }
        return { start, length: end - start };
    }

    const lines = sourceFile.text.split("\n");
    const offsets = lines.reduce<number[]>((res, line, i) => {
        res.push(i ? res.at(-1)! + lines[i - 1].length + 1 : 0);
        return res;
    }, []);

    interface Item extends ts.TextSpan {
        type: string;
    }

    const features: Record<string, Item[]> = {};
    const featureRE = /\/\* -+ (?<name>.*) -+ \*\//;
    const operationRE = /(?<=\/\/\s*)(?<range>\^—*\^)\((?<type>\w+)\)/;

    let items: Item[] | undefined;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const feature = line.match(featureRE);
        if (feature) {
            const { name } = feature.groups!;
            features[name] = items = [];
            continue;
        }

        const operation = line.match(operationRE);
        if (!operation) {
            continue;
        }

        const { range, type } = operation.groups!;
        const offset = offsets[i - 1] + operation.index!;

        items?.push({
            ...getSourceTextSpan(offset, offset + range.length),
            type,
        });
    }

    for (const [name, items] of Object.entries(features)) {
        it(name, () => {
            for (const { type, start, length } of items) {
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
            }
        });
    }
});
