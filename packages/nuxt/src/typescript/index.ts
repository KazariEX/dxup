/// <reference types="@volar/typescript"/>

import { join } from "pathe";
import type ts from "typescript";
import { createEventServer } from "../event/server";
import { findRenameLocations } from "./features/findRenameLocations";
import { getDefinitionAndBoundSpan } from "./features/getDefinitionAndBoundSpan";
import { getEditsForFileRename } from "./features/getEditsForFileRename";
import type { Context, Data } from "./types";

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
                ["findRenameLocations", findRenameLocations.bind(null, context)],
                ["getDefinitionAndBoundSpan", getDefinitionAndBoundSpan.bind(null, context)],
                ["getEditsForFileRename", getEditsForFileRename.bind(null, context)],
            ] as const) {
                const original = info.languageService[key];
                info.languageService[key] = method(original as any) as any;
            }

            return info.languageService;
        },
    };
};

export default plugin;

function createData(ts: typeof import("typescript"), info: ts.server.PluginCreateInfo) {
    const initialValue: Data = {
        buildDir: "",
        configFiles: [],
        components: true,
        nitroRoutes: {},
        runtimeConfig: true,
    };

    const currentDirectory = info.languageServiceHost.getCurrentDirectory();
    const path = join(currentDirectory, "dxup/data.json");
    const data = {} as Data;

    ts.sys.watchFile?.(path, (fileName, eventKind) => {
        if (eventKind !== ts.FileWatcherEventKind.Deleted) {
            update();
        }
    });
    update();

    return data;

    function update() {
        const text = ts.sys.readFile(path);
        Object.assign(data, {
            ...initialValue,
            ...text ? JSON.parse(text) : {},
        });
    }
}
