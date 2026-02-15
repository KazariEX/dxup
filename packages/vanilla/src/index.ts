import type ts from "typescript";
import { getApplicableRefactors } from "./features/getApplicableRefactors";
import { getDefinitionAndBoundSpan } from "./features/getDefinitionAndBoundSpan";
import { getEditsForRefactor } from "./features/getEditsForRefactor";

const plugin: ts.server.PluginModuleFactory = (module) => {
    const { typescript: ts } = module;

    return {
        create(info) {
            const methods: Record<PropertyKey, any> = {};

            for (const [key, method] of [
                ["getApplicableRefactors", getApplicableRefactors],
                ["getEditsForRefactor", getEditsForRefactor],
                ["getDefinitionAndBoundSpan", getDefinitionAndBoundSpan],
            ] as const) {
                const original = info.languageService[key];
                methods[key] = method(ts, info, original as any);
            }

            return new Proxy(info.languageService, {
                get(target, p, receiver) {
                    return methods[p] ?? Reflect.get(target, p, receiver);
                },
            });
        },
    };
};

export default plugin;
