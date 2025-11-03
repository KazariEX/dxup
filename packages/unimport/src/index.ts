import { forEachTouchingNode, isTextSpanWithin } from "@dxup/shared";
import type ts from "typescript";

const plugin: ts.server.PluginModuleFactory = (module) => {
    const { typescript: ts } = module;

    return {
        create(info) {
            for (const [key, method] of [
                ["findRenameLocations", findRenameLocations],
                ["findReferences", findReferences],
                ["getDefinitionAndBoundSpan", getDefinitionAndBoundSpan],
            ] as const) {
                const original = info.languageService[key];
                info.languageService[key] = method(ts, info, original as any) as any;
            }

            return info.languageService;
        },
    };
};

export default plugin;

const declarationRE = /\.d\.(?:c|m)?ts$/;

function createVisitor<T>(getter: (
    ts: typeof import("typescript"),
    name: ts.PropertyName,
    type: ts.TypeNode,
    textSpan: ts.TextSpan,
    sourceFile: ts.SourceFile,
) => T | undefined) {
    return (
        ts: typeof import("typescript"),
        textSpan: ts.TextSpan,
        sourceFile: ts.SourceFile,
    ) => {
        for (const node of forEachTouchingNode(ts, sourceFile, textSpan.start)) {
            if (
                ts.isPropertySignature(node) && node.type ||
                ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.type
            ) {
                const target = getter(ts, node.name as any, node.type, textSpan, sourceFile);
                if (target) {
                    return target;
                }
            }
        }
    };
}

const visitForwardImports = createVisitor((ts, name, type, textSpan, sourceFile) => {
    if (!isTextSpanWithin(name, textSpan, sourceFile)) {
        return;
    }

    while (ts.isTypeReferenceNode(type) && type.typeArguments?.length) {
        type = type.typeArguments[0];
    }

    if (ts.isIndexedAccessTypeNode(type)) {
        return type.indexType;
    }
    else if (ts.isImportTypeNode(type)) {
        return type.qualifier ?? type.argument;
    }
});

const visitBackwardImports = createVisitor((ts, name, type, textSpan, sourceFile) => {
    while (ts.isTypeReferenceNode(type) && type.typeArguments?.length) {
        type = type.typeArguments[0];
    }

    const targets: ts.Node[] = [];
    if (ts.isIndexedAccessTypeNode(type)) {
        if (ts.isLiteralTypeNode(type.indexType) && ts.isStringLiteral(type.indexType.literal)) {
            targets.push(type.indexType);
            if (type.indexType.literal.text === "default" && ts.isImportTypeNode(type.objectType)) {
                targets.push(type.objectType.argument);
            }
        }
    }
    else if (ts.isImportTypeNode(type)) {
        targets.push(type.qualifier ?? type.argument);
        if (type.qualifier && ts.isIdentifier(type.qualifier) && type.qualifier.text === "default") {
            targets.push(type.argument);
        }
    }
    else {
        return;
    }

    if (targets.some((target) => isTextSpanWithin(target, textSpan, sourceFile))) {
        return name;
    }
});

function findRenameLocations(
    ts: typeof import("typescript"),
    info: ts.server.PluginCreateInfo,
    findRenameLocations: ts.LanguageService["findRenameLocations"],
): ts.LanguageService["findRenameLocations"] {
    return (...args) => {
        // @ts-expect-error union args cannot satisfy deprecated overload
        const result = findRenameLocations(...args);
        if (!result?.length) {
            return result;
        }

        const program = info.languageService.getProgram()!;
        const preferences = typeof args[4] === "object" ? args[4] : {};
        const locations = [...result];

        for (const location of result) {
            const sourceFile = program.getSourceFile(location.fileName);
            if (!sourceFile) {
                continue;
            }

            if (!declarationRE.test(location.fileName)) {
                continue;
            }

            const args = [ts, location.textSpan, sourceFile] as const;
            const node = visitForwardImports(...args) ?? visitBackwardImports(...args);
            if (!node) {
                continue;
            }

            const position = node.getStart(sourceFile);
            const res = findRenameLocations(location.fileName, position, false, false, preferences);
            if (res?.length) {
                locations.push(...res);
            }
        }

        return locations;
    };
}

function findReferences(
    ts: typeof import("typescript"),
    info: ts.server.PluginCreateInfo,
    findReferences: ts.LanguageService["findReferences"],
): ts.LanguageService["findReferences"] {
    return (...args) => {
        const result = findReferences(...args);
        if (!result?.length) {
            return result;
        }

        const program = info.languageService.getProgram()!;

        for (const symbol of result) {
            const references = new Set(symbol.references);

            for (const reference of symbol.references) {
                const sourceFile = program.getSourceFile(reference.fileName);
                if (!sourceFile) {
                    continue;
                }

                if (!declarationRE.test(reference.fileName)) {
                    continue;
                }

                const node = visitBackwardImports(ts, reference.textSpan, sourceFile);
                if (!node) {
                    continue;
                }

                const position = node.getStart(sourceFile) + 1;
                const res = info.languageService.getReferencesAtPosition(reference.fileName, position)
                    ?.filter((entry) => entry.fileName !== reference.fileName ||
                        position < entry.textSpan.start ||
                        position > entry.textSpan.start + entry.textSpan.length);

                references.delete(reference);
                for (const reference of res ?? []) {
                    references.add(reference);
                }
            }
            symbol.references = [...references];
        }

        return result;
    };
}

function getDefinitionAndBoundSpan(
    ts: typeof import("typescript"),
    info: ts.server.PluginCreateInfo,
    getDefinitionAndBoundSpan: ts.LanguageService["getDefinitionAndBoundSpan"],
): ts.LanguageService["getDefinitionAndBoundSpan"] {
    return (...args) => {
        const result = getDefinitionAndBoundSpan(...args);
        if (!result?.definitions?.length) {
            return result;
        }

        const program = info.languageService.getProgram()!;
        const definitions = new Set(result.definitions);

        for (const definition of result.definitions) {
            const sourceFile = program.getSourceFile(definition.fileName);
            if (!sourceFile) {
                continue;
            }

            if (!declarationRE.test(definition.fileName)) {
                continue;
            }

            const node = visitForwardImports(ts, definition.textSpan, sourceFile);
            if (!node) {
                continue;
            }

            const position = node.getStart(sourceFile);
            const res = getDefinitionAndBoundSpan(definition.fileName, position);
            if (res?.definitions?.length) {
                definitions.delete(definition);
                for (const definition of res.definitions) {
                    definitions.add(definition);
                }
            }
        }

        return {
            definitions: [...definitions],
            textSpan: result.textSpan,
        };
    };
}
