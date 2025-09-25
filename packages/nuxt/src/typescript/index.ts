import { dirname, join } from "node:path";
import type ts from "typescript";
import { forEachNode, walkNodes } from "../utils/ast";

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

function getDefinitionAndBoundSpan(
    ts: typeof import("typescript"),
    info: ts.server.PluginCreateInfo,
    getDefinitionAndBoundSpan: ts.LanguageService["getDefinitionAndBoundSpan"],
): ts.LanguageService["getDefinitionAndBoundSpan"] {
    return (fileName, position) => {
        const result = getDefinitionAndBoundSpan(fileName, position);
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
            if (info.config.nitroRoutes && definition.fileName.endsWith("nitro-routes.d.ts")) {
                result = visitNitroRoutes(ts, sourceFile, definition, getDefinitionAndBoundSpan);
            }
            else if (info.config.runtimeConfig && definition.fileName.endsWith("runtime-config.d.ts")) {
                result = visitRuntimeConfig(ts, info, sourceFile, definition);
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

function visitNitroRoutes(
    ts: typeof import("typescript"),
    sourceFile: ts.SourceFile,
    definition: ts.DefinitionInfo,
    getDefinitionAndBoundSpan: ts.LanguageService["getDefinitionAndBoundSpan"],
) {
    const definitions: ts.DefinitionInfo[] = [];

    for (const node of forEachNode(sourceFile)) {
        if (!ts.isPropertySignature(node) || !node.type || !ts.isTypeLiteralNode(node.type)) {
            continue;
        }

        const { textSpan } = definition;
        const start = node.name.getStart(sourceFile);
        const end = node.name.getEnd();

        if (start !== textSpan.start || end - start !== textSpan.length) {
            continue;
        }

        for (const member of node.type.members) {
            if (!ts.isPropertySignature(member)) {
                continue;
            }

            const qualifier = (((((
                member.type as ts.TypeReferenceNode // Simplify<...>
            )?.typeArguments?.[0] as ts.TypeReferenceNode // Serialize<...>
            )?.typeArguments?.[0] as ts.TypeReferenceNode // Awaited<...>
            )?.typeArguments?.[0] as ts.TypeReferenceNode // ReturnType<...>
            )?.typeArguments?.[0] as ts.ImportTypeNode // typeof import("...").default
            )?.qualifier;

            const pos = qualifier?.getStart(sourceFile);
            if (pos !== void 0) {
                const res = getDefinitionAndBoundSpan(definition.fileName, pos);
                if (res?.definitions?.length) {
                    definitions.push(...res.definitions);
                }
            }
        }
        break;
    }

    return definitions;
}

function visitRuntimeConfig(
    ts: typeof import("typescript"),
    info: ts.server.PluginCreateInfo,
    sourceFile: ts.SourceFile,
    definition: ts.DefinitionInfo,
) {
    let definitions: ts.DefinitionInfo[] = [];
    const path: string[] = [];

    walkNodes(sourceFile, (node, next) => {
        let key: string | undefined;
        if (ts.isInterfaceDeclaration(node) && ts.isIdentifier(node.name)) {
            key = node.name.text;
        }
        else if (ts.isPropertySignature(node) && ts.isIdentifier(node.name)) {
            key = node.name.text;

            const { textSpan } = definition;
            const start = node.name.getStart(sourceFile);
            const end = node.name.getEnd();

            if (start === textSpan.start && end - start === textSpan.length) {
                path.push(key);
                definitions = [...proxyRuntimeConfig(ts, info, definition, path)];
                return;
            }
        }

        if (key !== void 0) {
            path.push(key);
        }
        next();
        if (key !== void 0) {
            path.pop();
        }
    });

    return definitions;
}

function* proxyRuntimeConfig(
    ts: typeof import("typescript"),
    info: ts.server.PluginCreateInfo,
    definition: ts.DefinitionInfo,
    path: string[],
): Generator<ts.DefinitionInfo> {
    switch (path[0]) {
        case "SharedRuntimeConfig": {
            path.shift();
            break;
        }
        case "SharedPublicRuntimeConfig": {
            path[0] = "public";
            break;
        }
        default: return;
    }

    const configName = join(dirname(info.project.getProjectName()), "tsconfig.node.json");
    const nodeProject = info.project.projectService.findProject(configName);
    if (!nodeProject) {
        return;
    }
    const nodeProgram = nodeProject.getLanguageService().getProgram();
    if (!nodeProgram) {
        return;
    }
    const nuxtConfigName = nodeProgram.getRootFileNames().find((name) => name.endsWith("nuxt.config.ts"));
    if (!nuxtConfigName) {
        return;
    }
    const sourceFile = nodeProgram.getSourceFile(nuxtConfigName);
    if (!sourceFile) {
        return;
    }

    const checker = nodeProgram.getTypeChecker();
    for (const node of sourceFile.statements) {
        if (
            ts.isExportAssignment(node) &&
            ts.isCallExpression(node.expression) &&
            node.expression.arguments.length
        ) {
            const arg = node.expression.arguments[0];
            let currentSymbol!: ts.Symbol;
            let currentType = checker.getTypeAtLocation(arg);

            for (const key of ["runtimeConfig", ...path]) {
                const properties = currentType.getProperties();
                const symbol = properties.find((s) => s.name === key);
                if (!symbol) {
                    return;
                }
                currentSymbol = symbol;
                currentType = checker.getTypeOfSymbol(symbol);
            }

            for (const decl of currentSymbol.declarations ?? []) {
                const sourceFile = decl.getSourceFile();
                const contextSpan = {
                    start: decl.getStart(sourceFile),
                    length: decl.getWidth(sourceFile),
                };
                yield {
                    ...definition,
                    contextSpan,
                    fileName: sourceFile.fileName,
                    textSpan: ts.isPropertyAssignment(decl) ? {
                        start: decl.name.getStart(sourceFile),
                        length: decl.name.getWidth(sourceFile),
                    } : contextSpan,
                };
            }
        }
    }
}
