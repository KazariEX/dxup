import { forEachTouchingNode } from "@dxup/shared";
import type ts from "typescript";

const plugin: ts.server.PluginModuleFactory = (module) => {
    const { typescript: ts } = module;

    return {
        create(info) {
            for (const [key, method] of [
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

                const index = node.parent.parameters.indexOf(node);
                const definitions: ts.DefinitionInfo[] = [];

                for (const signature of forEachSignature(ts, checker, node.parent)) {
                    const parameter = signature.parameters[index];
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
