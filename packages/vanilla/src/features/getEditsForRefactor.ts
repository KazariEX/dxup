import { forEachTouchingNode } from "@dxup/shared";
import type ts from "typescript";
import { refactors } from "../shared";

export function getEditsForRefactor(
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

        let node: ts.ParameterDeclaration | undefined;
        for (const child of forEachTouchingNode(ts, sourceFile, position)) {
            if (ts.isParameter(child)) {
                node = child;
            }
        }
        if (!node?.parent.name) {
            return;
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
        ) return;

        const modifier = direction === 0 && node.dotDotDotToken ? Infinity : direction;
        const fileTextChanges: Record<string, ts.TextChange[]> = {};
        const references = forEachSignatureReference(
            ts,
            info.languageService,
            args[0],
            node.parent.name.getStart(sourceFile),
        );

        for (const node of references) {
            const sourceFile = node.getSourceFile();
            const textChanges = fileTextChanges[sourceFile.fileName] ??= [];

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
    };
}

function* forEachSignatureReference(
    ts: typeof import("typescript"),
    languageService: ts.LanguageService,
    fileName: string,
    position: number,
    visited = new Set<string>(),
): Generator<ts.CallExpression | ts.SignatureDeclaration> {
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
            yield node.parent;
            continue;
        }
        // foo.swap(...)
        if (
            ts.isPropertyAccessExpression(node.parent) &&
            node === node.parent.name &&
            ts.isCallExpression(node.parent.parent) &&
            node.parent === node.parent.parent.expression
        ) {
            yield node.parent.parent;
            continue;
        }
        // swap(...) {}
        if (
            ts.isFunctionLike(node.parent) &&
            node === node.parent.name
        ) {
            yield node.parent;
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
                yield expression;
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
                    yield expression;
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
                    yield expression;
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
    modifier: number,
): Generator<ts.TextChange> {
    const spreadIndex = args.findIndex((arg) => ts.isSpreadElement(arg));
    if (spreadIndex !== -1 && spreadIndex <= Math.max(index, index + modifier)) {
        return;
    }

    if (modifier === 0 || modifier === Infinity) {
        const from = index;
        const to = modifier === Infinity ? args.length - 1 : Math.min(args.length - 1, index);
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
