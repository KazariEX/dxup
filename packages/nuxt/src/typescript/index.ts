import { join } from "node:path";
import { forEachNode, walkNodes } from "@dxup/shared";
import type ts from "typescript";

interface Data {
    buildDir: string;
    configFiles: string[];
    nitroRoutes: boolean;
    runtimeConfig: boolean;
}

interface Context {
    ts: typeof import("typescript");
    info: ts.server.PluginCreateInfo;
    data: Data;
}

const plugin: ts.server.PluginModuleFactory = (module) => {
    const { typescript: ts } = module;

    return {
        create(info) {
            const currentDirectory = info.languageServiceHost.getCurrentDirectory();
            const path = join(currentDirectory, "dxup.json");
            const data: Data = {
                buildDir: currentDirectory,
                configFiles: [],
                nitroRoutes: true,
                runtimeConfig: true,
                ...JSON.parse(
                    ts.sys.readFile(path) ?? "{}",
                ),
            };

            const context = { ts, info, data };

            for (const [key, method] of [
                ["getDefinitionAndBoundSpan", getDefinitionAndBoundSpan.bind(null, context)],
                ["getEditsForFileRename", getEditsForFileRename.bind(null, context)],
            ] as const) {
                const original = info.languageService[key];
                info.languageService[key] = method(original as any) as any;
            }

            return info.languageService;
        },
    };
};

export default plugin;

function getDefinitionAndBoundSpan(
    context: Context,
    getDefinitionAndBoundSpan: ts.LanguageService["getDefinitionAndBoundSpan"],
): ts.LanguageService["getDefinitionAndBoundSpan"] {
    const { info, data } = context;

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
            if (data.nitroRoutes && definition.fileName.endsWith("nitro-routes.d.ts")) {
                result = visitNitroRoutes(context, sourceFile, definition, getDefinitionAndBoundSpan);
            }
            else if (data.runtimeConfig && definition.fileName.endsWith("runtime-config.d.ts")) {
                result = visitRuntimeConfig(context, sourceFile, definition);
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
    context: Context,
    sourceFile: ts.SourceFile,
    definition: ts.DefinitionInfo,
    getDefinitionAndBoundSpan: ts.LanguageService["getDefinitionAndBoundSpan"],
) {
    const { ts } = context;
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
    context: Context,
    sourceFile: ts.SourceFile,
    definition: ts.DefinitionInfo,
) {
    const { ts } = context;

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
                definitions = [...proxyRuntimeConfig(context, definition, path)];
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
    context: Context,
    definition: ts.DefinitionInfo,
    path: string[],
): Generator<ts.DefinitionInfo> {
    const { ts, info, data } = context;

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

    const configFile = data.configFiles[0];
    if (configFile === void 0) {
        return;
    }
    const { configFileName } = info.project.projectService.openClientFile(configFile);
    if (configFileName === void 0) {
        return;
    }
    const nodeProject = info.project.projectService.findProject(configFileName);
    if (!nodeProject) {
        return;
    }
    const nodeProgram = nodeProject.getLanguageService().getProgram();
    if (!nodeProgram) {
        return;
    }

    const checker = nodeProgram.getTypeChecker();
    for (const configFile of data.configFiles) {
        const sourceFile = nodeProgram.getSourceFile(configFile);
        if (!sourceFile) {
            continue;
        }

        outer: for (const node of sourceFile.statements) {
            if (
                !ts.isExportAssignment(node) ||
                !ts.isCallExpression(node.expression) ||
                !node.expression.arguments.length
            ) {
                continue;
            }

            const arg = node.expression.arguments[0];
            let currentSymbol: ts.Symbol | undefined;
            let currentType = checker.getTypeAtLocation(arg);

            for (const key of ["runtimeConfig", ...path]) {
                const properties = currentType.getProperties();
                const symbol = properties.find((s) => s.name === key);
                if (!symbol) {
                    break outer;
                }
                currentSymbol = symbol;
                currentType = checker.getTypeOfSymbol(symbol);
            }

            for (const decl of currentSymbol?.declarations ?? []) {
                const sourceFile = decl.getSourceFile();
                const contextSpan = {
                    start: decl.getStart(sourceFile),
                    length: decl.getWidth(sourceFile),
                };

                let textSpan = contextSpan;
                if (ts.isPropertyAssignment(decl) || ts.isPropertySignature(decl)) {
                    textSpan = {
                        start: decl.name.getStart(sourceFile),
                        length: decl.name.getWidth(sourceFile),
                    };
                }

                yield {
                    ...definition,
                    fileName: sourceFile.fileName,
                    textSpan,
                    contextSpan,
                };
            }
        }
    }
}

function getEditsForFileRename(
    context: Context,
    getEditsForFileRename: ts.LanguageService["getEditsForFileRename"],
): ts.LanguageService["getEditsForFileRename"] {
    const { data } = context;

    return (...args) => {
        const result = getEditsForFileRename(...args);

        return result.filter((edit) => {
            return !edit.fileName.startsWith(data.buildDir);
        });
    };
}
