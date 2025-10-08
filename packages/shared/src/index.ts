import type ts from "typescript";

export function* forEachNode(
    ts: typeof import("typescript"),
    node: ts.Node,
): Generator<ts.Node> {
    yield node;
    const children = getChildren(ts, node);
    for (const child of children) {
        yield* forEachNode(ts, child);
    }
}

export function* forEachTouchNode(
    ts: typeof import("typescript"),
    sourceFile: ts.SourceFile,
    position: number,
) {
    yield* binaryForEach(ts, sourceFile, sourceFile, position);
}

function* binaryForEach(
    ts: typeof import("typescript"),
    sourceFile: ts.SourceFile,
    node: ts.Node,
    position: number,
): Generator<ts.Node> {
    const nodes = getChildren(ts, node);

    let left = 0;
    let right = nodes.length - 1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const node = nodes[mid];
        const start = node.getStart(sourceFile);
        const end = node.getEnd();

        if (position < start) {
            right = mid - 1;
        }
        else if (position > end) {
            left = mid + 1;
        }
        else {
            yield node;
            yield* binaryForEach(ts, sourceFile, node, position);
            return;
        }
    }
}

function getChildren(
    ts: typeof import("typescript"),
    node: ts.Node,
) {
    const children: ts.Node[] = [];
    ts.forEachChild(node, (child) => {
        children.push(child);
    });
    return children;
}
