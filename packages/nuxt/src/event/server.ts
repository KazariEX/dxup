import { appendFile } from "node:fs/promises";
import { join } from "pathe";
import type ts from "typescript";
import type { EventMap } from "./types";

export function createEventServer(info: ts.server.PluginCreateInfo) {
    const path = join(info.project.getCurrentDirectory(), "dxup/events.md");

    function write<K extends keyof EventMap>(key: K, data: EventMap[K][0]) {
        return appendFile(path, `\`\`\`json {${key}}\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`).catch();
    }

    return {
        write,
    };
}
