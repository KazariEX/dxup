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

// eslint-disable-next-line ts/no-unsafe-function-type
const callbacks: Record<string, Function[]> = {};

export function createData(ts: typeof import("typescript"), info: ts.server.PluginCreateInfo) {
    const currentDirectory = info.languageServiceHost.getCurrentDirectory();
    const path = join(currentDirectory, "dxup/data.json");
    const data = {} as Data;

    const updates = callbacks[path] ?? (
        ts.sys.watchFile?.(path, () => {
            const text = ts.sys.readFile(path);
            for (const update of updates) {
                update(text);
            }
        }),
        callbacks[path] = []
    );
    updates.push(update);
    update(ts.sys.readFile(path));

    return data;

    function update(text?: string) {
        Object.assign(data, {
            ...initialValue,
            ...text ? JSON.parse(text) : {},
        });
    }
}
