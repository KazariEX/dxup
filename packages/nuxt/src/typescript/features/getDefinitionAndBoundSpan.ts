import { forEachTouchingNode, isTextSpanEqual } from "@dxup/shared";
import { join } from "pathe";
import type ts from "typescript";
import type { Context } from "../types";

const fetchFunctions = new Set([
    "$fetch",
    "useFetch",
    "useLazyFetch",
]);

const nonApiRE = /^(?!\/api\/)/;

export function getDefinitionAndBoundSpan(
    context: Context,
    getDefinitionAndBoundSpan: ts.LanguageService["getDefinitionAndBoundSpan"],
): ts.LanguageService["getDefinitionAndBoundSpan"] {
    const { ts, info, data } = context;

    return (...args) => {
        const result = getDefinitionAndBoundSpan(...args);

        if (!result && data.nitroRoutes) {
            const program = info.languageService.getProgram()!;
            const sourceFile = program.getSourceFile(args[0]);
            if (!sourceFile) {
                return;
            }

            const checker = program.getTypeChecker();
            for (const node of forEachTouchingNode(ts, sourceFile, args[1])) {
                if (
                    !ts.isCallExpression(node) ||
                    !ts.isIdentifier(node.expression) ||
                    !fetchFunctions.has(node.expression.text) ||
                    !node.arguments.length
                ) {
                    continue;
                }

                const firstArg = node.arguments[0];
                const start = firstArg.getStart(sourceFile);
                const end = firstArg.getEnd();

                if (args[1] < start || args[1] > end) {
                    continue;
                }

                const resolvedSignature = checker.getResolvedSignature(node);
                if (!resolvedSignature) {
                    break;
                }

                const typeArguments = checker.getTypeArgumentsForResolvedSignature(resolvedSignature);
                const [routeType, methodType] = (
                    node.expression.text === "$fetch"
                        ? typeArguments?.[2] && checker.getTypeArguments(typeArguments?.[2] as ts.TypeReference)
                        : typeArguments?.slice(2)
                ) ?? [];

                if (!routeType?.isStringLiteral() || !methodType?.isStringLiteral()) {
                    break;
                }

                const route = routeType.value.replace(nonApiRE, "/routes");
                const method = methodType.value;
                const path = join(data.serverDir, `${route}.${method}.ts`);

                return {
                    textSpan: {
                        start,
                        length: end - start,
                    },
                    definitions: [{
                        fileName: path,
                        textSpan: { start: 0, length: 0 },
                        kind: ts.ScriptElementKind.scriptElement,
                        name: path,
                        containerKind: ts.ScriptElementKind.unknown,
                        containerName: "",
                    }],
                };
            }
            return;
        }

        if (!result?.definitions?.length) {
            return result;
        }

        const program = info.languageService.getProgram()!;
        const definitions = new Set<ts.DefinitionInfo>(result.definitions);

        for (const definition of result.definitions) {
            const sourceFile = program.getSourceFile(definition.fileName);
            if (!sourceFile) {
                continue;
            }

            let result: ts.DefinitionInfo[] = [];
            if (data.runtimeConfig && definition.fileName.endsWith("runtime-config.d.ts")) {
                result = visitRuntimeConfig(context, sourceFile, definition);
            }

            if (result?.length) {
                for (const definition of result) {
                    definitions.add(definition);
                }
                definitions.delete(definition);
            }
        }

        return {
            definitions: [...definitions],
            textSpan: result.textSpan,
        };
    };
}

function visitRuntimeConfig(
    context: Context,
    sourceFile: ts.SourceFile,
    definition: ts.DefinitionInfo,
) {
    const { ts } = context;

    let definitions: ts.DefinitionInfo[] = [];
    const path: string[] = [];

    for (const node of forEachTouchingNode(ts, sourceFile, definition.textSpan.start)) {
        let key: string | undefined;
        if (ts.isInterfaceDeclaration(node) && ts.isIdentifier(node.name)) {
            key = node.name.text;
        }
        else if (ts.isPropertySignature(node) && ts.isIdentifier(node.name)) {
            key = node.name.text;

            if (isTextSpanEqual(node.name, definition.textSpan, sourceFile)) {
                path.push(key);
                definitions = [...forwardRuntimeConfig(context, definition, path)];
                break;
            }
        }

        if (key !== void 0) {
            path.push(key);
        }
    }

    return definitions;
}

function* forwardRuntimeConfig(
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
