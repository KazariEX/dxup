import type ts from "typescript";

export function* forEachNode(node: ts.Node): Generator<ts.Node> {
    yield node;
    const children: ts.Node[] = [];
    node.forEachChild((child) => {
        children.push(child);
    });
    for (const child of children) {
        yield* forEachNode(child);
    }
}

export function walkNodes(node: ts.Node, callback: (node: ts.Node, next: () => void) => void) {
    callback(node, () => {
        node.forEachChild((child) => {
            walkNodes(child, callback);
        });
    });
}
