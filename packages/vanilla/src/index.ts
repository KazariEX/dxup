import type ts from "typescript";
import { getApplicableRefactors } from "./features/getApplicableRefactors";
import { getDefinitionAndBoundSpan } from "./features/getDefinitionAndBoundSpan";
import { getEditsForRefactor } from "./features/getEditsForRefactor";

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
