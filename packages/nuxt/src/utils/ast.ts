import type ts from "typescript";

export function* forEachNode(node: ts.Node): Generator<ts.Node> {
    yield node;
    for (const child of node.getChildren()) {
        yield* forEachNode(child);
    }
}

export function walkNodes(node: ts.Node, callback: (node: ts.Node, next: () => void) => void) {
    function next() {
        for (const child of node.getChildren()) {
            walkNodes(child, callback!);
        }
    }
    callback(node, next);
}
