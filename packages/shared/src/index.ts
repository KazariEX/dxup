import type ts from "typescript";

export function* forEachNode(
    ts: typeof import("typescript"),
    node: ts.Node,
): Generator<ts.Node> {
    yield node;
    const children: ts.Node[] = [];
    ts.forEachChild(node, (child) => {
        children.push(child);
    });
    for (const child of children) {
        yield* forEachNode(ts, child);
    }
}

export function walkNodes(
    ts: typeof import("typescript"),
    node: ts.Node,
    callback: (node: ts.Node, next: () => void) => void,
) {
    callback(node, () => {
        ts.forEachChild(node, (child) => {
            walkNodes(ts, child, callback);
        });
    });
}
