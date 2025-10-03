import type ts from "typescript";

export interface ComponentReferenceInfo {
    textSpan: ts.TextSpan;
    lazy?: boolean;
}

export interface EventMap {
    "components:rename": [data: {
        fileName: string;
        references: Record<string, ComponentReferenceInfo[]>;
    }];
}
