import { forEachTouchingNode } from "@dxup/shared";
import type ts from "typescript";

const plugin: ts.server.PluginModuleFactory = (module) => {
    const { typescript: ts } = module;

    return {
        create(info) {
            for (const [key, method] of [
                ["getApplicableRefactors", getApplicableRefactors],
                ["getEditsForRefactor", getEditsForRefactor],
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

const refactors = {
    rewrite: {
        parameter: {
            forward: {
                name: "Move parameter left",
                description: "Move parameter left",
                kind: "refactor.rewrite.parameter.forward",
            },
            backward: {
                name: "Move parameter right",
                description: "Move parameter right",
                kind: "refactor.rewrite.parameter.backward",
            },
            remove: {
                name: "Remove parameter",
                description: "Remove parameter",
                kind: "refactor.rewrite.parameter.remove",
            },
        },
    },
};

function getApplicableRefactors(
    ts: typeof import("typescript"),
    info: ts.server.PluginCreateInfo,
    getApplicableRefactors: ts.LanguageService["getApplicableRefactors"],
): ts.LanguageService["getApplicableRefactors"] {
    return (...args) => {
        const result = getApplicableRefactors(...args);

        const program = info.languageService.getProgram()!;
        const sourceFile = program.getSourceFile(args[0]);
        if (!sourceFile) {
            return result;
        }

        const position = typeof args[1] === "number" ? args[1] : args[1].pos;
        for (const node of forEachTouchingNode(ts, sourceFile, position)) {
            if (ts.isParameter(node) && node.parent.name) {
                result.push({
                    name: "Dxup",
                    description: "Dxup refactor actions",
                    actions: [
                        refactors.rewrite.parameter.forward,
                        refactors.rewrite.parameter.backward,
                        refactors.rewrite.parameter.remove,
                    ],
                });
            }
        }

        return result;
    };
}

function getEditsForRefactor(
    ts: typeof import("typescript"),
    info: ts.server.PluginCreateInfo,
    getEditsForRefactor: ts.LanguageService["getEditsForRefactor"],
): ts.LanguageService["getEditsForRefactor"] {
    return (...args) => {
        if (args[3] !== "Dxup") {
            return getEditsForRefactor(...args);
        }

        const program = info.languageService.getProgram()!;
        const sourceFile = program.getSourceFile(args[0])!;
        const position = typeof args[2] === "number" ? args[2] : args[2].pos;
        const direction =
            args[4] === refactors.rewrite.parameter.forward.name ? -1 :
            args[4] === refactors.rewrite.parameter.backward.name ? 1 :
            args[4] === refactors.rewrite.parameter.remove.name ? 0 : null;

        if (direction === null) {
            return;
        }

        for (const node of forEachTouchingNode(ts, sourceFile, position)) {
            if (!ts.isParameter(node) || !node.parent.name) {
                continue;
            }

            const firstArg = node.parent.parameters[0];
            const withThis = ts.isIdentifier(firstArg.name) && firstArg.name.text === "this";
            const index = node.parent.parameters.indexOf(node) - Number(withThis);

            if (
                index === -1 ||
                index + direction < 0 ||
                index + direction === node.parent.parameters.length || (
                    direction !== 0 && (
                        node.dotDotDotToken || node.parent.parameters[index + direction].dotDotDotToken
                    )
                )
            ) break;

            const modifier = direction === 0 && node.dotDotDotToken ? 2333 : direction;
            const fileTextChanges: Record<string, ts.TextChange[]> = {};
            const references = forEachSignatureReference(
                ts,
                info.languageService,
                args[0],
                node.parent.name.getStart(sourceFile),
            );

            for (const [fileName, node] of references) {
                const sourceFile = program.getSourceFile(fileName)!;
                const textChanges = fileTextChanges[fileName] ??= [];

                if (ts.isCallExpression(node)) {
                    textChanges.push(...calculateTextChanges(
                        ts,
                        sourceFile,
                        node.arguments,
                        index,
                        modifier,
                    ));
                }
                else {
                    let index2 = index;
                    const firstArg = node.parameters[0];
                    if (ts.isIdentifier(firstArg.name) && firstArg.name.text === "this") {
                        index2++;
                    }
                    textChanges.push(...calculateTextChanges(
                        ts,
                        sourceFile,
                        node.parameters,
                        index2,
                        modifier,
                    ));
                }
            }

            return {
                edits: Object.entries(fileTextChanges).map(([fileName, textChanges]) => ({
                    fileName,
                    textChanges,
                })),
            };
        }
    };
}

function* forEachSignatureReference(
    ts: typeof import("typescript"),
    languageService: ts.LanguageService,
    fileName: string,
    position: number,
    visited = new Set<string>(),
): Generator<[fileName: string, node: ts.CallExpression | ts.SignatureDeclaration]> {
    const program = languageService.getProgram()!;
    const references = languageService.getReferencesAtPosition(fileName, position) ?? [];

    outer: for (const { fileName, textSpan } of references) {
        const key = fileName + "@" + textSpan.start;
        if (visited.has(key)) {
            continue;
        }
        visited.add(key);

        const sourceFile = program.getSourceFile(fileName)!;

        let node: ts.Identifier | undefined;
        for (const child of forEachTouchingNode(ts, sourceFile, textSpan.start)) {
            if (ts.isIdentifier(child)) {
                node = child;
                break;
            }
        }
        if (!node) {
            continue;
        }

        // swap(...)
        if (
            ts.isCallExpression(node.parent) &&
            node === node.parent.expression
        ) {
            yield [fileName, node.parent];
            continue;
        }
        // foo.swap(...)
        if (
            ts.isPropertyAccessExpression(node.parent) &&
            node === node.parent.name &&
            ts.isCallExpression(node.parent.parent) &&
            node.parent === node.parent.parent.expression
        ) {
            yield [fileName, node.parent.parent];
            continue;
        }
        // swap(...) {}
        if (
            ts.isFunctionLike(node.parent) &&
            node === node.parent.name
        ) {
            yield [fileName, node.parent];
            continue;
        }
        // swap: (...) => {}
        if (
            (ts.isPropertyAssignment(node.parent) || ts.isPropertyDeclaration(node.parent)) &&
            node === node.parent.name &&
            node.parent.initializer
        ) {
            const expression = getUnwrappedExpression(ts, node.parent.initializer);
            if (ts.isFunctionLike(expression)) {
                yield [fileName, expression];
                continue;
            }
        }

        let start: number;
        let curr: ts.Node = node;

        inner: while (curr) {
            // const foo = swap;
            //       ^^^   ^^^^
            if (
                ts.isVariableDeclaration(curr.parent) &&
                curr === curr.parent.initializer
            ) {
                start = curr.parent.name.getStart(sourceFile);
            }
            // const foo = { swap: swap };
            //               ^^^^  ^^^^
            else if (
                (ts.isPropertyAssignment(curr.parent) || ts.isPropertyDeclaration(curr.parent)) &&
                curr === curr.parent.initializer
            ) {
                start = curr.parent.name.getStart(sourceFile);
            }
            // const foo = { swap };
            //               ^^^^
            else if (ts.isShorthandPropertyAssignment(curr.parent)) {
                start = curr.getStart(sourceFile);
            }
            // const foo: typeof swap = {};
            //       ^^^         ^^^^
            else if (
                ts.isTypeQueryNode(curr.parent) &&
                curr === curr.parent.exprName &&
                ts.isVariableDeclaration(curr.parent.parent) &&
                curr.parent.parent.initializer
            ) {
                const expression = getUnwrappedExpression(ts, curr.parent.parent.initializer);
                if (ts.isFunctionLike(expression)) {
                    yield [fileName, expression];
                }
                start = curr.parent.parent.name.getStart(sourceFile);
            }
            // const foo = {} as typeof swap;
            //       ^^^                ^^^^
            else if (
                ts.isTypeQueryNode(curr.parent) &&
                curr === curr.parent.exprName &&
                ts.isAsExpression(curr.parent.parent) &&
                curr.parent.parent.expression
            ) {
                const expression = getUnwrappedExpression(ts, curr.parent.parent.expression);
                if (ts.isFunctionLike(expression)) {
                    yield [fileName, expression];
                }
                curr = curr.parent.parent;
                continue inner;
            }
            // const foo = {} as { swap: typeof swap };
            //                     ^^^^         ^^^^
            else if (
                ts.isTypeQueryNode(curr.parent) &&
                curr === curr.parent.exprName &&
                ts.isPropertySignature(curr.parent.parent)
            ) {
                start = curr.parent.parent.name.getStart(sourceFile);
            }
            else {
                continue outer;
            }
            break;
        }

        yield* forEachSignatureReference(
            ts,
            languageService,
            fileName,
            start!,
            visited,
        );
    }
}

function getUnwrappedExpression(ts: typeof import("typescript"), node: ts.Expression) {
    while (ts.isParenthesizedExpression(node)) {
        node = node.expression;
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
            node = node.right;
        }
    }
    return node;
}

function* calculateTextChanges(
    ts: typeof import("typescript"),
    sourceFile: ts.SourceFile,
    args: ts.NodeArray<ts.Node>,
    index: number,
    modifier: -1 | 1 | 0 | 2333,
): Generator<ts.TextChange> {
    const spreadIndex = args.findIndex((arg) => ts.isSpreadElement(arg));
    if (spreadIndex !== -1 && spreadIndex <= Math.max(index, index + modifier)) {
        return;
    }

    if (modifier === 0 || modifier === 2333) {
        const from = index;
        const to = modifier === 2333 ? args.length - 1 : Math.min(args.length - 1, index);
        const [start, end] = from ? [
            args[from - 1].end,
            args[to].end,
        ] : [
            args[from].getStart(sourceFile),
            args[to + 1]?.getStart(sourceFile) ?? args[to].end,
        ];
        yield {
            span: {
                start,
                length: end - start,
            },
            newText: "",
        };
        return;
    }

    for (let i = index; modifier === -1 ? i >= index + modifier : i <= index + modifier; i += modifier) {
        yield {
            span: {
                start: args[i].getStart(sourceFile),
                length: args[i].getWidth(sourceFile),
            },
            newText: args[i === index ? i + modifier : index].getText(sourceFile),
        };
    }
}

function getDefinitionAndBoundSpan(
    ts: typeof import("typescript"),
    info: ts.server.PluginCreateInfo,
    getDefinitionAndBoundSpan: ts.LanguageService["getDefinitionAndBoundSpan"],
): ts.LanguageService["getDefinitionAndBoundSpan"] {
    return (...args) => {
        const result = getDefinitionAndBoundSpan(...args);
        if (!result?.definitions?.length) {
            return;
        }

        if (result.definitions[0].kind === ts.ScriptElementKind.parameterElement) {
            const program = info.languageService.getProgram()!;
            const sourceFile = program.getSourceFile(args[0])!;
            const checker = program.getTypeChecker();

            for (const node of forEachTouchingNode(ts, sourceFile, args[1])) {
                if (!ts.isParameter(node) || node.dotDotDotToken) {
                    continue;
                }

                const firstArg = node.parent.parameters[0];
                const withThis = ts.isIdentifier(firstArg.name) && firstArg.name.text === "this";
                const index = node.parent.parameters.indexOf(node) - Number(withThis);
                const definitions: ts.DefinitionInfo[] = [];

                for (const signature of forEachSignature(ts, checker, node.parent)) {
                    const parameter = index === -1 ? signature.thisParameter : signature.parameters[index];
                    if (!parameter?.declarations) {
                        continue;
                    }

                    for (const declaration of parameter.declarations) {
                        if (!ts.isParameter(declaration) || declaration.dotDotDotToken) {
                            continue;
                        }

                        const sourceFile = declaration.getSourceFile();
                        definitions.push({
                            fileName: sourceFile.fileName,
                            textSpan: {
                                start: declaration.getStart(sourceFile),
                                length: declaration.getWidth(sourceFile),
                            },
                            kind: ts.ScriptElementKind.parameterElement,
                            name: declaration.getText(sourceFile),
                            containerKind: ts.ScriptElementKind.unknown,
                            containerName: "",
                        });
                    }
                }

                if (definitions.length) {
                    result.definitions = definitions;
                }
            }
        }

        return result;
    };
}

function* forEachSignature(
    ts: typeof import("typescript"),
    checker: ts.TypeChecker,
    signature: ts.SignatureDeclaration,
): Generator<ts.Signature> {
    if (ts.isExpression(signature)) {
        const contextualType = checker.getContextualType(signature);
        yield* flattenSignatures(contextualType);
    }
    else if (
        ts.isMethodDeclaration(signature) &&
        ts.isIdentifier(signature.name) &&
        ts.isObjectLiteralExpression(signature.parent)
    ) {
        const contextualType = checker.getContextualType(signature.parent);
        for (const type of forEachType(contextualType)) {
            const property = type.getProperty(signature.name.text);
            if (property) {
                const propertyType = checker.getTypeOfSymbol(property);
                yield* flattenSignatures(propertyType);
            }
        }
    }
}

function* flattenSignatures(type?: ts.Type): Generator<ts.Signature> {
    if (type?.isUnionOrIntersection()) {
        for (const subtype of type.types) {
            yield* flattenSignatures(subtype);
        }
    }
    else if (type) {
        yield* type.getCallSignatures();
    }
}

function* forEachType(type?: ts.Type): Generator<ts.Type> {
    if (type?.isUnionOrIntersection()) {
        for (const subtype of type.types) {
            yield* forEachType(subtype);
        }
    }
    else if (type) {
        yield type;
    }
}
