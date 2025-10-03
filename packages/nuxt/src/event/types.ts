import type ts from "typescript";

export interface EventMap {
    "references:component": [data: {
        fileName: string;
        references: (Pick<ts.ReferencedSymbolEntry, "fileName" | "textSpan"> & {
            lazy?: boolean;
        })[];
    }];
}
