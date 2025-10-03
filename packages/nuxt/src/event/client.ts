import { Buffer } from "node:buffer";
import EventEmitter from "node:events";
import { mkdir, open, writeFile } from "node:fs/promises";
import { watch } from "chokidar";
import { dirname, join } from "pathe";
import type { Nuxt } from "nuxt/schema";
import type { EventMap } from "./types";

const responseRE = /^```json \{(?<key>.*)\}\n(?<value>[\s\S]*?)\n```$/;

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
        await fd.read(buffer, 0, buffer.length, pos);
        const text = buffer.toString("utf-8").trim();

        const match = text.match(responseRE);
        if (match) {
            const { key, value } = match.groups!;
            // @ts-expect-error [any] cannot satisfy never
            client.emit(key, JSON.parse(value));
        }
    });

    return client;
}
