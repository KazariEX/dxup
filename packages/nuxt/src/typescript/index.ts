/// <reference types="@volar/typescript"/>

import type ts from "typescript";
import { createEventServer } from "../event/server";
import { createData } from "./data";
import * as findReferences from "./features/findReferences";
import * as findRenameLocations from "./features/findRenameLocations";
import * as getDefinitionAndBoundSpan from "./features/getDefinitionAndBoundSpan";
import * as getEditsForFileRename from "./features/getEditsForFileRename";
import type { Context } from "./types";

const plugin: ts.server.PluginModuleFactory = (module) => {
    const { typescript: ts } = module;

    return {
        create(info) {
            const data = createData(ts, info);
            const server = createEventServer(info);

            const context: Context = { ts, info, data, server };
            setTimeout(() => {
                context.language = (info.project as any).__vue__?.language;

                if (!context.language || !data.features.unimport.componentReferences) {
                    return;
                }

                // Because the volar based plugin is loaded latest,
                // it prevents the current plugin from accessing the original position
                // at the time the language service request is triggered.
                // If no mapping exists for that position, the request will be simply skipped.
                const languageService = info.project.getLanguageService();
                const methods: Record<PropertyKey, any> = {};

                for (const [key, method] of [
                    ["findReferences", findReferences],
                    ["getDefinitionAndBoundSpan", getDefinitionAndBoundSpan],
                ] as const) {
                    const original = languageService[key];
                    methods[key] = method.postprocess(context, context.language, original as any) as any;
                }

                // eslint-disable-next-line dot-notation
                info.project["languageService"] = new Proxy(languageService, {
                    get(target, p, receiver) {
                        return methods[p] ?? Reflect.get(target, p, receiver);
                    },
                    set(...args) {
                        return Reflect.set(...args);
                    },
                });
            }, 0);

            for (const [key, method] of [
                ["findRenameLocations", findRenameLocations],
                ["getDefinitionAndBoundSpan", getDefinitionAndBoundSpan],
                ["getEditsForFileRename", getEditsForFileRename],
            ] as const) {
                const original = info.languageService[key];
                info.languageService[key] = method.preprocess(context, original as any) as any;
            }

            return info.languageService;
        },
    };
};

export default plugin;
