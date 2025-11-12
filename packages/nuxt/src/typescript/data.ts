import { join } from "pathe";
import type ts from "typescript";
import type { Data } from "./types";

const initialValue: Data = {
    buildDir: "",
    publicDir: "",
    configFiles: [],
    nitroRoutes: {},
    features: {
        components: true,
        importGlob: true,
        nitroRoutes: true,
        runtimeConfig: true,
    },
};

const callbacks: Record<string, ((text?: string) => void)[]> = {};

export function createData(ts: typeof import("typescript"), info: ts.server.PluginCreateInfo) {
    const currentDirectory = info.languageServiceHost.getCurrentDirectory();
    const path = join(currentDirectory, "dxup/data.json");
    const data = {} as Data;

    const updates = callbacks[path] ??= (
        ts.sys.watchFile?.(path, () => {
            const text = ts.sys.readFile(path);
            for (const update of updates) {
                update(text);
            }
        }), []
    );

    updates.push((text) => {
        Object.assign(data, {
            ...initialValue,
            ...text ? JSON.parse(text) : {},
        });
    });

    const text = ts.sys.readFile(path);
    updates.at(-1)!(text);

    return data;
}
