import type CompilerDOM from "@vue/compiler-dom";
import type { VueLanguagePlugin } from "@vue/language-core";
import type ts from "typescript";
import { isInDir } from "./utils";

interface Config {
  options: {
    dirs: string[];
  };
}

const plugin: VueLanguagePlugin<Config> = ({
  modules: { typescript: ts, "@vue/compiler-dom": CompilerDOM },
  config: { options },
}) => ({
  version: 2.2,
  order: -1,
  resolveEmbeddedCode(fileName, sfc, embeddedCode) {
    if (!embeddedCode.id.startsWith("script_")) {
      return;
    }

    if (!options.dirs.some((dir) => isInDir(fileName, dir))) {
      return;
    }

    if (!sfc.template?.ast) {
      return;
    }

    if (sfc.template.ast.children.length === 1) {
      const root = sfc.template.ast.children[0];
      if (root.loc.start.offset === Number.MAX_VALUE) {
        return;
      }
    }

    let layoutName = "default";
    if (sfc.scriptSetup) {
      visit(sfc.scriptSetup.ast);
    }

    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "definePageMeta" &&
        node.arguments.length &&
        ts.isObjectLiteralExpression(node.arguments[0])
      ) {
        for (const prop of node.arguments[0].properties) {
          if (
            ts.isPropertyAssignment(prop) &&
            ts.isIdentifier(prop.name) &&
            prop.name.text === "layout" &&
            ts.isStringLiteral(prop.initializer)
          ) {
            layoutName = prop.initializer.text;
            break;
          }
        }
      }
      else {
        ts.forEachChild(node, visit);
      }
    }

    const expression = `\n// @ts-ignore\n{} as import("#build/dxup/layouts").Layouts["${layoutName}"]\n`;
    const children = sfc.template.ast.children;

    sfc.template.ast.children = [{
      type: CompilerDOM.NodeTypes.ELEMENT,
      ns: CompilerDOM.Namespaces.HTML,
      tag: "component",
      tagType: CompilerDOM.ElementTypes.COMPONENT,
      loc: createVirtualLoc(),
      props: [{
        type: CompilerDOM.NodeTypes.DIRECTIVE,
        name: "bind",
        arg: {
          type: CompilerDOM.NodeTypes.SIMPLE_EXPRESSION,
          content: "is",
          isStatic: true,
          constType: CompilerDOM.ConstantTypes.CAN_STRINGIFY,
          loc: createVirtualLoc("is"),
        },
        exp: {
          type: CompilerDOM.NodeTypes.SIMPLE_EXPRESSION,
          content: expression,
          isStatic: false,
          constType: CompilerDOM.ConstantTypes.NOT_CONSTANT,
          loc: createVirtualLoc(expression),
        },
        modifiers: [],
        loc: createVirtualLoc(`:is="${expression}"`),
      }],
      children,
      codegenNode: void 0,
    }];
  },
});

export default plugin;

function createVirtualLoc(source = ""): CompilerDOM.SourceLocation {
  return {
    start: {
      line: Number.MAX_VALUE,
      column: Number.MAX_VALUE,
      offset: Number.MAX_VALUE,
    },
    end: {
      line: Number.MAX_VALUE,
      column: Number.MAX_VALUE,
      offset: Number.MAX_VALUE,
    },
    source,
  };
}
