import { dirname, join } from "node:path";
import type ts from "typescript";

const plugin: ts.server.PluginModuleFactory = (module) => {
    const { typescript: ts } = module;

    return {
        create(info) {
            const original = info.languageService.getDefinitionAndBoundSpan;
            info.languageService.getDefinitionAndBoundSpan = getDefinitionAndBoundSpan(
                ts,
                info,
                original,
            );

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
    const { languageService, project } = info;

    return (fileName, position) => {
        const result = getDefinitionAndBoundSpan(fileName, position);
        if (!result?.definitions?.length) {
            return result;
        }

        const program = languageService.getProgram()!;
        const definitions = new Set<ts.DefinitionInfo>(result.definitions);
        const skippedDefinitions: ts.DefinitionInfo[] = [];

        for (const definition of result.definitions) {
            if (definition.fileName.endsWith("nitro-routes.d.ts")) {
                const sourceFile = program.getSourceFile(definition.fileName);
                if (!sourceFile) {
                    continue;
                }
                visitNitroRoutes(sourceFile, definition, sourceFile);
            }
            else if (definition.fileName.endsWith("runtime-config.d.ts")) {
                const sourceFile = program.getSourceFile(definition.fileName);
                if (!sourceFile) {
                    continue;
                }
                visitRuntimeConfig(sourceFile, definition, sourceFile);
            }
        }

        for (const definition of skippedDefinitions) {
            definitions.delete(definition);
        }

        return {
            definitions: [...definitions],
            textSpan: result.textSpan,
        };

        function visitNitroRoutes(
            node: ts.Node,
            definition: ts.DefinitionInfo,
            sourceFile: ts.SourceFile,
        ) {
            if (ts.isPropertySignature(node) && node.type && ts.isTypeLiteralNode(node.type)) {
                const { textSpan } = definition;
                const start = node.name.getStart(sourceFile);
                const end = node.name.getEnd();

                if (start === textSpan.start && end - start === textSpan.length) {
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
                                for (const definition of res.definitions) {
                                    definitions.add(definition);
                                }
                                skippedDefinitions.push(definition);
                            }
                        }
                    }
                }
            }
            else {
                ts.forEachChild(node, (child) => visitNitroRoutes(child, definition, sourceFile));
            }
        }

        function visitRuntimeConfig(
            node: ts.Node,
            definition: ts.DefinitionInfo,
            sourceFile: ts.SourceFile,
            path: string[] = [],
        ) {
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
                    const nodeProject = project.projectService.findProject(configName);
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
                    sourceFile.forEachChild((node) => {
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
                                definitions.add({
                                    ...definition,
                                    contextSpan,
                                    fileName: sourceFile.fileName,
                                    textSpan: ts.isPropertyAssignment(decl) ? {
                                        start: decl.name.getStart(sourceFile),
                                        length: decl.name.getWidth(sourceFile),
                                    } : contextSpan,
                                });
                            }
                            skippedDefinitions.push(definition);
                        }
                    });
                    return;
                }
            }

            if (key !== void 0) {
                path.push(key);
            }
            ts.forEachChild(node, (child) => visitRuntimeConfig(child, definition, sourceFile, path));
            if (key !== void 0) {
                path.pop();
            }
        }
    };
}
