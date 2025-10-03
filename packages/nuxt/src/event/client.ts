import { Buffer } from "node:buffer";
import EventEmitter from "node:events";
import { mkdir, open, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { watch } from "chokidar";
import type { Nuxt } from "nuxt/schema";
import type { EventMap } from "./types";

export async function createEventClient(nuxt: Nuxt) {
    const path = join(nuxt.options.buildDir, "dxup/events.md");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "");

    const fd = await open(path, "r");
    const watcher = watch(path, {
        ignoreInitial: true,
    });

    nuxt.hook("close", async () => {
        await fd.close();
        await watcher.close();
    });

    const client = new EventEmitter<EventMap>();
    let offset = 0;

    watcher.on("change", async (path, stats) => {
        if (!stats || stats.size <= offset) {
            return;
        }
        const pos = offset;
        offset = stats.size;

        const buffer = Buffer.alloc(offset - pos);
        const result = await fd.read(buffer, 0, buffer.length, pos);
        const text = result.buffer.toString("utf-8", 0, result.bytesRead).trim();

        const match = text.match(/^```json \{(?<key>.*)\}\n(?<value>[\s\S]*?)\n```$/);
        if (match) {
            const { key, value } = match.groups!;
            // @ts-expect-error [any] cannot satisfies never
            client.emit(key, JSON.parse(value));
        }
    });

    return client;
}
