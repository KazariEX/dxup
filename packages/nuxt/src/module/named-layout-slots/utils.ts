import { type ElementNode, NodeTypes, parse, type RootNode, type TemplateChildNode } from "@vue/compiler-dom";
import { isAbsolute, relative } from "pathe";

const vueRE = /[?&]vue(?:&|$)/;
const typeRE = /[?&]type=[^&]*/;

export function isVue(id: string) {
  const index = id.indexOf("?");
  const query = index !== -1 ? id.slice(index) : void 0;

  if (query === void 0) {
    return id.endsWith(".vue");
  }

  if (query === "?macro=true") {
    return true;
  }

  if (!vueRE.test(query)) {
    return false;
  }

  if (typeRE.test(query)) {
    return false;
  }

  return true;
}

export function isInDir(path: string, dir: string) {
  const rel = relative(dir, path);
  return rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel);
}

export function parseSFC(code: string) {
  const sfc = parse(code, {
    parseMode: "sfc",
  });

  let scriptSetup: ElementNode | undefined;
  let template: ElementNode | undefined;

  for (const node of sfc.children) {
    if (node.type !== NodeTypes.ELEMENT) {
      continue;
    }
    if (
      node.tag === "script" && node.props.some((prop) => (
        prop.type === NodeTypes.ATTRIBUTE && (prop.name === "setup" || prop.name === "vapor")
      ))
    ) {
      scriptSetup = node;
    }
    else if (node.tag === "template") {
      template = node;
    }
  }

  return {
    scriptSetup,
    template,
  };
}

export function* forEachElementNode(node: RootNode | TemplateChildNode): Generator<ElementNode> {
  if (
    node.type === NodeTypes.ROOT ||
    node.type === NodeTypes.FOR ||
    node.type === NodeTypes.IF_BRANCH
  ) {
    for (const child of node.children) {
      yield* forEachElementNode(child);
    }
  }
  else if (node.type === NodeTypes.ELEMENT) {
    yield node;
    for (const child of node.children) {
      yield* forEachElementNode(child);
    }
  }
  else if (node.type === NodeTypes.IF) {
    for (const branch of node.branches) {
      yield* forEachElementNode(branch);
    }
  }
}
