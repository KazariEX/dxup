import type { Language } from "@volar/language-core";
import type ts from "typescript";
import type { createEventServer } from "../event/server";

export interface Data {
    buildDir: string;
    publicDir: string;
    configFiles: string[];
    nitroRoutes: Record<string, string>;
    features: {
        components: boolean;
        importGlob: boolean;
        nitroRoutes: boolean;
        runtimeConfig: boolean;
    };
}

export interface Context {
    ts: typeof import("typescript");
    info: ts.server.PluginCreateInfo;
    data: Data;
    server: ReturnType<typeof createEventServer>;
    language?: Language;
}
