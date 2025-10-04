import { forEachNode } from "@dxup/shared";
import type ts from "typescript";

const plugin: ts.server.PluginModuleFactory = (module) => {
    const { typescript: ts } = module;

    return {
        create(info) {
            for (const [key, method] of [
                ["findRenameLocations", findRenameLocations.bind(null, ts, info)],
                ["findReferences", findReferences.bind(null, ts, info)],
                ["getDefinitionAndBoundSpan", getDefinitionAndBoundSpan.bind(null, ts, info)],
            ] as const) {
                const original = info.languageService[key];
                info.languageService[key] = method(original as any) as any;
            }

            return info.languageService;
        },
    };
};

export default plugin;

const declarationRE = /\.d\.(?:c|m)?ts$/;

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

            const positions = visitImports(ts, location.textSpan, sourceFile);
            for (const pos of positions) {
                const res = findRenameLocations(location.fileName, pos, false, false, preferences);
                if (res?.length) {
                    locations.push(...res);
                }
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
        const symbols = [...result];

        for (const symbol of symbols) {
            const references = [];

            for (const reference of symbol.references) {
                const sourceFile = program.getSourceFile(reference.fileName);
                if (!sourceFile) {
                    continue;
                }

                if (!declarationRE.test(reference.fileName)) {
                    continue;
                }

                const positions = visitImports(ts, reference.textSpan, sourceFile);
                const result = [...positions].flatMap((pos) => {
                    const entries = info.languageService.getReferencesAtPosition(reference.fileName, pos);
                    return entries?.filter((entry) => entry.textSpan.start !== pos) ?? [];
                });

                if (result.length) {
                    references.push(...result);
                }
                else {
                    references.push(reference);
                }
            }
            symbol.references = references;
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
        const definitions = new Set<ts.DefinitionInfo>(result.definitions);
        const skippedDefinitions: ts.DefinitionInfo[] = [];

        for (const definition of result.definitions) {
            const sourceFile = program.getSourceFile(definition.fileName);
            if (!sourceFile) {
                continue;
            }

            if (!declarationRE.test(definition.fileName)) {
                continue;
            }

            const positions = visitImports(ts, definition.textSpan, sourceFile);
            for (const pos of positions) {
                const res = getDefinitionAndBoundSpan(definition.fileName, pos);
                if (res?.definitions?.length) {
                    for (const def of res.definitions) {
                        definitions.add(def);
                    }
                    skippedDefinitions.push(definition);
                }
            }
        }

        for (const definition of skippedDefinitions) {
            definitions.delete(definition);
        }

        return {
            definitions: [...definitions],
            textSpan: result.textSpan,
        };
    };
}

function visitImports(
    ts: typeof import("typescript"),
    textSpan: ts.TextSpan,
    sourceFile: ts.SourceFile,
) {
    const positions = new Set<number>();

    for (const node of forEachNode(ts, sourceFile)) {
        let pos: number | undefined;

        if (ts.isPropertySignature(node) && node.type) {
            const args = [ts, node.name, node.type, textSpan, sourceFile] as const;
            pos = forwardTypeofImport(...args) ?? backwardTypeofImport(...args);
        }
        else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.type) {
            const args = [ts, node.name, node.type, textSpan, sourceFile] as const;
            pos = forwardTypeofImport(...args) ?? backwardTypeofImport(...args);
        }

        if (pos !== void 0) {
            positions.add(pos);
            break;
        }
    }

    return positions;
}

function forwardTypeofImport(
    ts: typeof import("typescript"),
    name: ts.PropertyName,
    type: ts.TypeNode,
    textSpan: ts.TextSpan,
    sourceFile: ts.SourceFile,
) {
    const start = name.getStart(sourceFile);
    const end = name.getEnd();

    if (start !== textSpan.start || end - start !== textSpan.length) {
        return;
    }

    if (ts.isIndexedAccessTypeNode(type)) {
        return type.indexType.getStart(sourceFile);
    }
    else if (ts.isImportTypeNode(type)) {
        return (type.qualifier ?? type.argument).getStart(sourceFile);
    }
}

function backwardTypeofImport(
    ts: typeof import("typescript"),
    name: ts.PropertyName,
    type: ts.TypeNode,
    textSpan: ts.TextSpan,
    sourceFile: ts.SourceFile,
) {
    let start: number;
    let end: number;

    if (ts.isIndexedAccessTypeNode(type)) {
        start = type.indexType.getStart(sourceFile);
        end = type.indexType.getEnd();
    }
    else if (ts.isImportTypeNode(type)) {
        start = (type.qualifier ?? type.argument).getStart(sourceFile);
        end = (type.qualifier ?? type.argument).getEnd();
    }
    else {
        return;
    }

    if (start === textSpan.start && end - start === textSpan.length) {
        return name.getStart(sourceFile);
    }
}
