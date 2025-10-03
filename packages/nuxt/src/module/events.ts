import { readFile, writeFile } from "node:fs/promises";
import type { Nuxt } from "nuxt/schema";
import type { ComponentReferenceInfo, EventMap } from "../event/types";

export async function onComponentsRename(
    nuxt: Nuxt,
    { fileName, references }: EventMap["components:rename"][0],
) {
    const groups = new Map<string, ComponentReferenceInfo[]>();
    for (const reference of references) {
        let group = groups.get(reference.fileName);
        if (!group) {
            groups.set(reference.fileName, group = []);
        }
        group.push(reference);
    }

    const component = Object.values(nuxt.apps)
        .flatMap((app) => app.components)
        .find((c) => c.filePath === fileName);
    if (!component) {
        return;
    }

    for (const [fileName, references] of groups) {
        const code = await readFile(fileName, "utf-8");
        const chunks: string[] = [];
        let offset = 0;
        for (const { textSpan, lazy } of references) {
            const start = textSpan.start;
            const end = start + textSpan.length;
            const oldName = code.slice(start, end);
            const newName = /[A-Z]/.test(oldName)
                ? lazy ? "Lazy" + component.pascalName : component.pascalName
                : lazy ? "lazy-" + component.kebabName : component.kebabName;
            chunks.push(code.slice(offset, start), newName);
            offset = end;
        }
        chunks.push(code.slice(offset));
        await writeFile(fileName, chunks.join(""));
    }
}
