import type ts from "typescript";

const plugin: ts.server.PluginModuleFactory = (module) => {
    const { typescript: ts } = module;

    return {
        create(info) {
            const original = info.languageService.getDefinitionAndBoundSpan;
            info.languageService.getDefinitionAndBoundSpan = getDefinitionAndBoundSpan(
                ts,
                info.languageService,
                original,
            );

            return info.languageService;
        },
    };
};

export default plugin;

function getDefinitionAndBoundSpan(
    ts: typeof import("typescript"),
    languageService: ts.LanguageService,
    getDefinitionAndBoundSpan: ts.LanguageService["getDefinitionAndBoundSpan"],
): ts.LanguageService["getDefinitionAndBoundSpan"] {
    return (fileName, position) => {
        const result = getDefinitionAndBoundSpan(fileName, position);
        if (!result?.definitions?.length) {
            return result;
        }

        const program = languageService.getProgram()!;
        const definitions = new Set<ts.DefinitionInfo>(result.definitions);
        const skippedDefinitions: ts.DefinitionInfo[] = [];

        for (const definition of result.definitions) {
            if (!definition.fileName.endsWith("nitro-routes.d.ts")) {
                continue;
            }
            const sourceFile = program.getSourceFile(definition.fileName);
            if (sourceFile) {
                visit(sourceFile, definition, sourceFile);
            }
        }

        for (const definition of skippedDefinitions) {
            definitions.delete(definition);
        }

        return {
            definitions: [...definitions],
            textSpan: result.textSpan,
        };

        function visit(
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
                ts.forEachChild(node, (child) => visit(child, definition, sourceFile));
            }
        }
    };
}
