import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import LayoutSlots, { LayoutSlot, LayoutSlotsForward } from "../packages/nuxt/src/module/named-layout-slots/runtime/layouts";

const Layout = defineComponent((_props, ctx) => {
  return () => [
    h("header", [
      h(LayoutSlot, { name: "header" }, () => "fallback"),
    ]),
    h("main", ctx.slots.default?.()),
  ];
});

async function render(page: object) {
  const html = await renderToString(h(LayoutSlots, null, {
    default: () => h(Layout, null, {
      default: () => h(LayoutSlotsForward, null, page),
    }),
  }));
  return html.replaceAll(/<!--[[\]]-->/g, "");
}

describe("named layout slots", () => {
  it("should render the fallback when the page does not provide the slot", async () => {
    const html = await render({ default: () => h("div", "page") });

    expect(html).toContain("<header>fallback</header>");
  });

  it("should prefer the slot provided by the page", async () => {
    const html = await render({
      default: () => h("div", "page"),
      header: () => "from page",
    });

    expect(html).toContain("<header>from page</header>");
  });
});
