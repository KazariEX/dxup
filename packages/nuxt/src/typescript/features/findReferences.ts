import type ts from "typescript";
import { isVueVirtualCode, withVirtualOffset } from "../utils";
import type { Context } from "../types";

export function postprocess(
    context: Context,
    findReferences: ts.LanguageService["findReferences"],
): ts.LanguageService["findReferences"] {
    const { ts, info, language } = context;

    return (...args) => {
        const result = findReferences(...args);

        if (!result?.length) {
            const sourceScript = language?.scripts.get(args[0]);
            const root = sourceScript?.generated?.root;
            if (!isVueVirtualCode(root)) {
                return;
            }

            const start = (root.sfc.template?.start ?? Infinity) + 1;
            if (args[1] < start || args[1] > start + "template".length) {
                return;
            }

            const program = info.languageService.getProgram()!;
            const sourceFile = program.getSourceFile(args[0]);
            if (!sourceFile) {
                return;
            }

            for (const statement of sourceFile.statements) {
                if (ts.isExportAssignment(statement)) {
                    const defaultKeyword = statement.getChildAt(1);
                    return withVirtualOffset(
                        language!,
                        sourceScript!,
                        defaultKeyword.getStart(sourceFile),
                        (position) => findReferences(args[0], position),
                    );
                }
            }
            return;
        }

        return result;
    };
}
