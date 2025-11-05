/// <reference types="@volar/typescript"/>

import type ts from "typescript";
import { createEventServer } from "../event/server";
import { createData } from "./data";
import { findRenameLocations } from "./features/findRenameLocations";
import { getDefinitionAndBoundSpan } from "./features/getDefinitionAndBoundSpan";
import { getEditsForFileRename } from "./features/getEditsForFileRename";
import type { Context } from "./types";

const plugin: ts.server.PluginModuleFactory = (module) => {
    const { typescript: ts } = module;

    return {
        create(info) {
            const data = createData(ts, info);
            const server = createEventServer(info);

            const context: Context = { ts, info, data, server };
            setTimeout(() => {
                // eslint-disable-next-line dot-notation
                context.language = ((info.project as any).__vue__ ?? info.project["program"]?.__vue__)?.language;
            }, 500);

            for (const [key, method] of [
                ["findRenameLocations", findRenameLocations],
                ["getDefinitionAndBoundSpan", getDefinitionAndBoundSpan],
                ["getEditsForFileRename", getEditsForFileRename],
            ] as const) {
                const original = info.languageService[key];
                info.languageService[key] = method(context, original as any) as any;
            }

            return info.languageService;
        },
    };
};

export default plugin;
