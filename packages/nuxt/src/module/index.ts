import { readFile, writeFile } from "node:fs/promises";
import { addTemplate, defineNuxtModule } from "@nuxt/kit";
import * as packageJson from "../../package.json";
import { createEventClient } from "../event/client";
import type { ComponentReferenceInfo } from "../event/types";

interface Plugin {
    name: string;
    options?: Record<string, any>;
}

export interface ModuleOptions {
    components?: boolean;
    nitroRoutes?: boolean;
    runtimeConfig?: boolean;
    unimport?: boolean;
}

export default defineNuxtModule<ModuleOptions>({
    meta: {
        name: packageJson.name,
        configKey: "dxup",
    },
    defaults: {
        components: true,
        nitroRoutes: true,
        runtimeConfig: true,
        unimport: true,
    },
    async setup(options, nuxt) {
        const pluginsTs: Plugin[] = [{ name: "@dxup/nuxt" }];
        const pluginsVue: string[] = [];

        if (options.nitroRoutes) {
            pluginsVue.push("@dxup/nuxt/vue/nitro-routes");
        }
        if (options.unimport) {
            pluginsTs.push({ name: "@dxup/unimport" });
        }

        append(pluginsTs, nuxt.options, "typescript", "tsConfig", "compilerOptions");
        append(pluginsTs, nuxt.options.nitro, "typescript", "tsConfig", "compilerOptions");
        append(pluginsTs, nuxt.options, "typescript", "sharedTsConfig", "compilerOptions");
        append(pluginsTs, nuxt.options, "typescript", "nodeTsConfig", "compilerOptions");
        append(pluginsVue, nuxt.options, "typescript", "tsConfig", "vueCompilerOptions");

        addTemplate({
            filename: "dxup/data.json",
            write: true,
            getContents() {
                const data = {
                    buildDir: nuxt.options.buildDir,
                    configFiles: [
                        ...nuxt.options._nuxtConfigFiles,
                        ...nuxt.options._layers.map((layer) => layer._configFile).filter(Boolean),
                    ],
                    components: options.components,
                    nitroRoutes: options.nitroRoutes,
                    runtimeConfig: options.runtimeConfig,
                };
                return JSON.stringify(data, null, 2);
            },
        });

        const client = await createEventClient(nuxt);

        client.on("components:rename", async ({ fileName, references }) => {
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
        });
    },
});

function append<
    T extends Record<string, any>,
    K0 extends keyof T,
    K1 extends keyof NonNullable<T[K0]>,
    K2 extends keyof NonNullable<NonNullable<T[K0]>[K1]>,
>(plugins: any[], target: T, ...keys: [K0, K1?, K2?]) {
    for (const key of keys) {
        target = (target as any)[key] ??= {};
    }
    ((target as any).plugins ??= []).push(...plugins);
}
