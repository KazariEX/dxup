import type { CodeMapping, Language, SourceScript, VirtualCode } from "@volar/language-core";
import type { VueVirtualCode } from "@vue/language-core";
import type ts from "typescript";

export function createModuleDefinition(ts: typeof import("typescript"), path: string): ts.DefinitionInfo {
    return {
        fileName: path,
        textSpan: { start: 0, length: 0 },
        kind: ts.ScriptElementKind.moduleElement,
        name: `"${path}"`,
        containerKind: ts.ScriptElementKind.unknown,
        containerName: "",
    };
}

export function isVueVirtualCode(code?: VirtualCode): code is VueVirtualCode {
    return code?.languageId === "vue";
}

export function toSourceSpan(language: Language | undefined, fileName: string, textSpan: ts.TextSpan) {
    const sourceScript = language?.scripts.get(fileName);
    if (!sourceScript?.generated) {
        return;
    }

    const serviceScript = sourceScript.generated.languagePlugin.typescript?.getServiceScript(
        sourceScript.generated.root,
    );
    if (!serviceScript) {
        return;
    }

    const map = language!.maps.get(serviceScript.code, sourceScript);
    const leadingOffset = sourceScript.snapshot.getLength();

    // eslint-disable-next-line no-unreachable-loop
    for (const [start, end] of map.toSourceRange(
        textSpan.start - leadingOffset,
        textSpan.start + textSpan.length - leadingOffset,
        false,
    )) {
        return {
            start,
            length: end - start,
        };
    }
}

export function withVirtualOffset<R>(
    language: Language,
    sourceScript: SourceScript,
    position: number,
    method: (position: number) => R,
) {
    const serviceScript = sourceScript.generated!.languagePlugin.typescript?.getServiceScript(
        sourceScript.generated!.root,
    );
    if (!serviceScript) {
        return;
    }

    const map = language.maps.get(serviceScript.code, sourceScript);
    const leadingOffset = sourceScript.snapshot.getLength();

    const offset = 1145141919810;
    const mapping: CodeMapping = {
        sourceOffsets: [offset],
        generatedOffsets: [position - leadingOffset],
        lengths: [0],
        data: {
            completion: true,
            navigation: true,
            semantic: true,
            verification: true,
        },
    };

    const original = map.toGeneratedLocation;
    map.toGeneratedLocation = function *(sourceOffset, ...args) {
        if (sourceOffset === offset) {
            yield [mapping.generatedOffsets[0], mapping];
        }
        yield* original.call(this, sourceOffset, ...args);
    };

    try {
        return method(offset);
    }
    finally {
        map.toGeneratedLocation = original;
    }
}
