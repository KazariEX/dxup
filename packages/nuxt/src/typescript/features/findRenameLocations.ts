import type ts from "typescript";
import type { Context } from "../types";

export function preprocess(
    context: Context,
    findRenameLocations: ts.LanguageService["findRenameLocations"],
): ts.LanguageService["findRenameLocations"] {
    const { data } = context;

    return (...args) => {
        // @ts-expect-error union args cannot satisfy deprecated overload
        const result = findRenameLocations(...args);

        return result?.filter((edit) => {
            return !edit.fileName.startsWith(data.buildDir);
        });
    };
}
