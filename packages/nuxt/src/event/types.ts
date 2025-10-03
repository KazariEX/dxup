import type ts from "typescript";

export type ComponentReferenceInfo = Pick<ts.ReferencedSymbolEntry, "fileName" | "textSpan"> & {
    lazy?: boolean;
};

export interface EventMap {
    "components:rename": [data: {
        fileName: string;
        references: ComponentReferenceInfo[];
    }];
}
