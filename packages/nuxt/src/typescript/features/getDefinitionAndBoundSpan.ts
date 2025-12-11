import { forEachTouchingNode, isTextSpanWithin } from "@dxup/shared";
import { extname, join } from "pathe";
import { globSync } from "tinyglobby";
import type { Language } from "@volar/language-core";
import type ts from "typescript";
import { createDefinitionInfo, isVueVirtualCode } from "../utils";
import type { Context, Data } from "../types";

const fetchFunctions = new Set([
    "$fetch",
    "useFetch",
    "useLazyFetch",
]);

export function postprocess(
    context: Context,
    language: Language,
    getDefinitionAndBoundSpan: ts.LanguageService["getDefinitionAndBoundSpan"],
): ts.LanguageService["getDefinitionAndBoundSpan"] {
    const { ts } = context;

    return (...args) => {
        const result = getDefinitionAndBoundSpan(...args);

        if (!result?.definitions?.length) {
            const sourceScript = language.scripts.get(args[0]);
            const root = sourceScript?.generated?.root;
            if (!isVueVirtualCode(root)) {
                return result;
            }

            const textSpan = {
                start: (root.sfc.template?.start ?? Infinity) + 1,
                length: "template".length,
            };

            // return a self-location result used to trigger alternative operations (findReferences)
            if (args[1] >= textSpan.start && args[1] <= textSpan.start + textSpan.length) {
                return {
                    textSpan,
                    definitions: [createDefinitionInfo(ts, args[0])],
                };
            }
            return result;
        }

        return result;
    };
}

export function preprocess(
    context: Context,
    getDefinitionAndBoundSpan: ts.LanguageService["getDefinitionAndBoundSpan"],
): ts.LanguageService["getDefinitionAndBoundSpan"] {
    const { ts, info, data } = context;

    return (...args) => {
        const result = getDefinitionAndBoundSpan(...args);

        if (!result) {
            const program = info.languageService.getProgram()!;
            const sourceFile = program.getSourceFile(args[0]);
            if (!sourceFile) {
                return;
            }

            const checker = program.getTypeChecker();

            let result: ts.DefinitionInfoAndBoundSpan | undefined;
            for (const node of forEachTouchingNode(ts, sourceFile, args[1])) {
                if (data.features.importGlob) {
                    result ??= visitImportGlob(ts, info, sourceFile, node, args[1]);
                }
                if (data.features.nitroRoutes) {
                    result ??= visitNitroRoutes(ts, data, checker, sourceFile, node, args[1]);
                }
                if (data.features.typedPages) {
                    result ??= visitTypedPages(ts, data, checker, sourceFile, node, args[1]);
                }
            }

            if (result) {
                return result;
            }
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

            let result: ts.DefinitionInfo[] | undefined;
            if (data.features.runtimeConfig && definition.fileName.endsWith("runtime-config.d.ts")) {
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

function visitImportGlob(
    ts: typeof import("typescript"),
    info: ts.server.PluginCreateInfo,
    sourceFile: ts.SourceFile,
    node: ts.Node,
    position: number,
) {
    if (!ts.isCallExpression(node) || !node.arguments.length) {
        return;
    }

    const firstArg = node.arguments[0];
    const start = firstArg.getStart(sourceFile);
    const end = firstArg.getEnd();

    if (position < start || position > end) {
        return;
    }

    let pattern: string | undefined;

    const callText = node.expression.getText(sourceFile);
    if (callText === "import" && ts.isTemplateExpression(firstArg)) {
        pattern = [
            firstArg.head.text,
            ...firstArg.templateSpans.map((span) => span.literal.text),
        ].join("*");
    }
    else if (callText === "import.meta.glob" && ts.isStringLiteral(firstArg)) {
        pattern = firstArg.text;
    }
    if (pattern === void 0) {
        return;
    }

    const resolved = ts.resolveModuleName(
        pattern,
        sourceFile.fileName,
        info.languageServiceHost.getCompilationSettings(),
        {
            fileExists: () => true,
            readFile: () => "",
        },
    );
    if (!resolved?.resolvedModule) {
        return;
    }

    const extension = extname(pattern);
    const arbitrary = `.d${extension}.ts`;

    pattern = resolved.resolvedModule.resolvedFileName;
    if (resolved.resolvedModule.extension === arbitrary) {
        pattern = pattern.slice(0, -arbitrary.length) + extension;
    }

    const fileNames = globSync(pattern, {
        absolute: true,
    });

    return {
        textSpan: {
            start,
            length: end - start,
        },
        definitions: fileNames.map((fileName) => createDefinitionInfo(ts, fileName)),
    };
}

function visitNitroRoutes(
    ts: typeof import("typescript"),
    data: Data,
    checker: ts.TypeChecker,
    sourceFile: ts.SourceFile,
    node: ts.Node,
    position: number,
) {
    if (
        !ts.isCallExpression(node) ||
        !ts.isIdentifier(node.expression) ||
        !fetchFunctions.has(node.expression.text) ||
        !node.arguments.length ||
        !ts.isStringLiteralLike(node.arguments[0])
    ) {
        return;
    }

    const firstArg = node.arguments[0];
    const start = firstArg.getStart(sourceFile);
    const end = firstArg.getEnd();

    if (position < start || position > end) {
        return;
    }

    const resolvedSignature = checker.getResolvedSignature(node);
    if (!resolvedSignature) {
        return;
    }

    const typeArguments = checker.getTypeArgumentsForResolvedSignature(resolvedSignature);
    let routeType: ts.Type | undefined;
    let methodType: ts.Type | undefined;

    if (node.expression.text === "$fetch") {
        routeType = typeArguments?.[1];
        const symbol = typeArguments?.[2].getProperty("method");
        methodType = symbol ? checker.getTypeOfSymbol(symbol) : void 0;
    }
    else {
        routeType = typeArguments?.[2];
        methodType = typeArguments?.[3];
    }

    const paths: string[] = [];
    if (routeType?.isStringLiteral()) {
        const alternatives = data.nitroRoutes[routeType.value] ?? {};
        const methods: string[] = [];

        for (const type of methodType?.isUnion() ? methodType.types : [methodType]) {
            if (type?.isStringLiteral()) {
                methods.push(type.value);
            }
        }
        for (const method of methods.length ? methods : Object.keys(alternatives)) {
            const path = alternatives[method];
            if (path !== void 0) {
                paths.push(path);
            }
        }
    }

    if (!paths.length && firstArg.text.startsWith("/")) {
        const fallback = join(data.publicDir, firstArg.text);
        if (ts.sys.fileExists(fallback)) {
            paths.push(fallback);
        }
    }

    return {
        textSpan: {
            start,
            length: end - start,
        },
        definitions: paths.map((path) => createDefinitionInfo(ts, path)),
    };
}

function visitTypedPages(
    ts: typeof import("typescript"),
    data: Data,
    checker: ts.TypeChecker,
    sourceFile: ts.SourceFile,
    node: ts.Node,
    position: number,
) {
    if (
        !ts.isPropertyAssignment(node) ||
        !ts.isIdentifier(node.name) ||
        node.name.text !== "name" ||
        !ts.isStringLiteralLike(node.initializer)
    ) {
        return;
    }

    const start = node.initializer.getStart(sourceFile);
    const end = node.initializer.getEnd();

    if (position < start || position > end) {
        return;
    }

    const contextualType = checker.getContextualType(node.parent);
    if (contextualType?.getNonNullableType().aliasSymbol?.name !== "RouteLocationRaw") {
        return;
    }

    const path = data.typedPages[node.initializer.text];
    if (path === void 0) {
        return;
    }

    return {
        textSpan: {
            start,
            length: end - start,
        },
        definitions: [createDefinitionInfo(ts, path)],
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

            if (isTextSpanWithin(node.name, definition.textSpan, sourceFile)) {
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
