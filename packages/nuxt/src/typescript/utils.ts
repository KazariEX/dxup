import type { Language } from "@volar/language-core";
import type ts from "typescript";

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
