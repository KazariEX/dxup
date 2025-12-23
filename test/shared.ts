import { Buffer } from "node:buffer";
import { relative } from "pathe";
import ts from "typescript";
import { expect } from "vitest";

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

export const projectService = new ts.server.ProjectService({
    cancellationToken: ts.server.nullCancellationToken,
    globalPlugins: [
        "@dxup/vanilla",
        "@vue/typescript-plugin",
    ],
    host: ts.sys as any,
    logger,
    session,
    useInferredProjectPerProjectRoot: false,
    useSingleInferredProject: false,
});

export function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Operation extends ts.TextSpan {
    scope: string;
    type: string;
}

const scopeRE = /(?:\/\*|<!--) -{14} (?<scope>[ \w]+) -{14} (?:\*\/|-->)/;
const rangeRE = /\^—*\^/;
const operationRE = /(?<range>\^—*\^)\((?<type>\w+)\)(?<skip>\.skip\(\))?/g;

export function collectOperations(sourceText: string) {
    if (!rangeRE.test(sourceText)) {
        return [];
    }

    const lines = sourceText.split("\n");
    const offsets = lines.reduce<number[]>((res, line, i) => {
        res.push(i ? res.at(-1)! + lines[i - 1].length + 1 : 0);
        return res;
    }, []);

    const items: Operation[] = [];
    let currentScope!: string;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const match = line.match(scopeRE);
        if (match) {
            currentScope = match.groups!.scope;
            continue;
        }

        for (const match of line.matchAll(operationRE)) {
            const { range, type, skip } = match.groups!;
            if (skip !== void 0) {
                continue;
            }

            items.push({
                scope: currentScope,
                type,
                start: offsets[i - 1] + match.index!,
                length: range.length,
            });
        }
    }

    return items;
}

export function expectOperation(
    type: string,
    languageService: ts.LanguageService,
    projectRoot: string,
    sourceFile: ts.SourceFile,
    start: number,
    length: number,
) {
    if (type === "definition") {
        const result = languageService.getDefinitionAndBoundSpan(sourceFile.fileName, start);
        expect(result).toBeDefined();
        expect(result!.textSpan).toEqual({ start, length });
        expect(
            result!.definitions?.map((definition) => ({
                fileName: relative(projectRoot, definition.fileName),
                textSpan: definition.textSpan,
            })),
        ).toMatchSnapshot(type);
    }
    else if (type === "references") {
        const result = languageService.findReferences(sourceFile.fileName, start);
        expect(result).toBeDefined();
        expect(
            result![0].references
                .filter((entry) => (
                    entry.fileName !== sourceFile.fileName ||
                    start < entry.textSpan.start ||
                    start > entry.textSpan.start + entry.textSpan.length
                ))
                .map((entry) => ({
                    fileName: relative(projectRoot, entry.fileName),
                    textSpan: entry.textSpan,
                })),
        ).toMatchSnapshot(type);
    }
}
