import type ts from "typescript";

export interface EventMap {
    "components:rename": [data: {
        fileName: string;
        references: (Pick<ts.ReferencedSymbolEntry, "fileName" | "textSpan"> & {
            lazy?: boolean;
        })[];
    }];
}
