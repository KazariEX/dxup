import { addTemplate, defineNuxtModule, useNitro } from "@nuxt/kit";
import * as packageJson from "../../package.json";
import { createEventClient } from "../event/client";
import { onComponentsRename } from "./events";
import type { Data } from "../typescript/types";

interface Plugin {
    name: string;
    options?: Record<string, any>;
}

export interface ModuleOptions {
    features?: {
        /**
         * Whether to update references when renaming auto imported component files.
         * @default true
         */
        components?: boolean;
        /**
         * Whether to enable Go to Definition for dynamic imports with glob patterns.
         * @default true
         */
        importGlob?: boolean;
        /**
         * Whether to enable Go to Definition for nitro routes in data fetching methods.
         * @default true
         */
        nitroRoutes?: boolean;
        /**
         * Whether to enable Go to Definition for runtime config.
         * @default true
         */
        runtimeConfig?: boolean;
        /**
         * Whether to enable Go to Definition for typed pages.
         * @default true
         */
        typedPages?: boolean;
        /**
         * Whether to enable enhanced navigation for auto imported APIs.
         * @default true
         */
        unimport?: boolean | {
            /**
             * Whether to enable Find References for SFC on `<template>`.
             */
            componentReferences: boolean;
        };
    };
}

export default defineNuxtModule<ModuleOptions>().with({
    meta: {
        name: packageJson.name,
        configKey: "dxup",
    },
    defaults: {
        features: {
            components: true,
            importGlob: true,
            nitroRoutes: true,
            runtimeConfig: true,
            typedPages: true,
            unimport: true,
        },
    },
    async setup(options, nuxt) {
        const pluginsTs: Plugin[] = [{ name: "@dxup/nuxt" }];

        if (options.features?.unimport) {
            pluginsTs.unshift({ name: "@dxup/unimport" });
        }

        append(pluginsTs, nuxt.options, "typescript", "tsConfig", "compilerOptions");
        append(pluginsTs, nuxt.options.nitro, "typescript", "tsConfig", "compilerOptions");
        append(pluginsTs, nuxt.options, "typescript", "sharedTsConfig", "compilerOptions");
        append(pluginsTs, nuxt.options, "typescript", "nodeTsConfig", "compilerOptions");

        addTemplate({
            filename: "dxup/data.json",
            write: true,
            getContents({ nuxt, app }) {
                const nitro = useNitro();
                const nitroRoutes = nitro.scannedHandlers.reduce((acc, item) => {
                    if (item.route && item.method) {
                        (acc[item.route] ??= {})[item.method] = item.handler;
                    }
                    return acc;
                }, {} as Data["nitroRoutes"]);

                const data = {
                    buildDir: nuxt.options.buildDir,
                    publicDir: nuxt.options.dir.public,
                    configFiles: [
                        ...nuxt.options._nuxtConfigFiles,
                        ...nuxt.options._layers.map((layer) => layer._configFile).filter(Boolean),
                    ],
                    nitroRoutes,
                    typedPages: Object.fromEntries(
                        app.pages?.map((page) => [page.name, page.file]) ?? [],
                    ),
                    features: {
                        ...options.features,
                        unimport: {
                            componentReferences: typeof options.features.unimport === "object"
                                ? options.features.unimport.componentReferences
                                : options.features.unimport,
                        },
                    },
                };
                return JSON.stringify(data, null, 2);
            },
        });

        if (nuxt.options.dev) {
            const client = await createEventClient(nuxt);
            client.on("components:rename", (data) => onComponentsRename(nuxt, data));
        }
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
