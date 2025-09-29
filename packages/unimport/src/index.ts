import { forEachNode } from "@dxup/shared";
import type ts from "typescript";

const plugin: ts.server.PluginModuleFactory = (module) => {
    const { typescript: ts } = module;

    return {
        create(info) {
            for (const [key, method] of [
                ["getDefinitionAndBoundSpan", getDefinitionAndBoundSpan.bind(null, ts, info)],
            ] as const) {
                const original = info.languageService[key];
                info.languageService[key] = method(original);
            }

            return info.languageService;
        },
    };
};

export default plugin;

const declarationRE = /\.d\.(?:c|m)?ts$/;

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

            let result: ts.DefinitionInfo[] = [];
            if (declarationRE.test(definition.fileName)) {
                result = visitImports(ts, definition.textSpan, sourceFile, getDefinitionAndBoundSpan);
            }

            if (result?.length) {
                for (const definition of result) {
                    definitions.add(definition);
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
    getDefinitionAndBoundSpan: ts.LanguageService["getDefinitionAndBoundSpan"],
) {
    const definitions: ts.DefinitionInfo[] = [];

    for (const node of forEachNode(ts, sourceFile)) {
        let pos: number | undefined;

        if (ts.isBindingElement(node)) {
            const name = node.propertyName ?? node.name;
            if (ts.isIdentifier(name)) {
                pos = proxyBindingElement(name, textSpan, sourceFile);
            }
        }
        else if (ts.isPropertySignature(node) && node.type) {
            pos = proxyTypeofImport(ts, node.name, node.type, textSpan, sourceFile);
        }
        else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.type) {
            pos = proxyTypeofImport(ts, node.name, node.type, textSpan, sourceFile);
        }

        if (pos !== void 0) {
            const res = getDefinitionAndBoundSpan(sourceFile.fileName, pos);
            if (res?.definitions?.length) {
                definitions.push(...res?.definitions);
            }
            break;
        }
    }

    return definitions;
}

function proxyBindingElement(
    name: ts.Identifier,
    textSpan: ts.TextSpan,
    sourceFile: ts.SourceFile,
) {
    const start = name.getStart(sourceFile);
    const end = name.getEnd();

    if (start !== textSpan.start || end - start !== textSpan.length) {
        return;
    }

    return name.getStart(sourceFile);
}

function proxyTypeofImport(
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
        return type.argument.getStart(sourceFile);
    }
}
