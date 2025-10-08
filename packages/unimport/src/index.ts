import { forEachTouchNode } from "@dxup/shared";
import type ts from "typescript";

const plugin: ts.server.PluginModuleFactory = (module) => {
    const { typescript: ts } = module;

    return {
        create(info) {
            for (const [key, method] of [
                ["findRenameLocations", findRenameLocations.bind(null, ts, info)],
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

            const node = visitImports(ts, location.textSpan, sourceFile);
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

            const node = visitImports(ts, definition.textSpan, sourceFile);
            if (!node) {
                continue;
            }

            const position = node.getStart(sourceFile);
            const res = getDefinitionAndBoundSpan(definition.fileName, position);
            if (res?.definitions?.length) {
                for (const def of res.definitions) {
                    definitions.add(def);
                }
                skippedDefinitions.push(definition);
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
    for (const node of forEachTouchNode(ts, sourceFile, textSpan.start)) {
        let target: ts.Node | undefined;

        if (ts.isPropertySignature(node) && node.type) {
            target = forwardTypeofImport(ts, node.name, node.type, textSpan, sourceFile);
        }
        else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.type) {
            target = forwardTypeofImport(ts, node.name, node.type, textSpan, sourceFile);
        }

        if (target) {
            return target;
        }
    }
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

    while (ts.isTypeReferenceNode(type) && type.typeArguments?.length) {
        type = type.typeArguments[0];
    }

    if (ts.isIndexedAccessTypeNode(type)) {
        return type.indexType;
    }
    else if (ts.isImportTypeNode(type)) {
        return type.argument;
    }
}
