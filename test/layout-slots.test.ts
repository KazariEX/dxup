import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import NuxtLayout, { LayoutSlot, LayoutSlotsForward } from "../packages/nuxt/src/module/named-layout-slots/runtime/layouts";

const Layout = defineComponent((props, ctx) => {
  return () => [
    h("header", [
      h(LayoutSlot, { name: "header" }, () => "fallback"),
    ]),
    h("main", ctx.slots.default?.()),
  ];
});

function render(page: Record<string, unknown>) {
  return renderToString(
    h(NuxtLayout, null, {
      default: () => h(Layout, null, {
        default: () => h(LayoutSlotsForward, null, page),
      }),
    }),
  );
}

describe("named layout slots", () => {
  it("should prefer the slot provided by the page", async () => {
    const html = await render({
      default: () => h("div", "page"),
      header: () => "from page",
    });

    expect(html).toContain("<header><!--[-->from page<!--]--></header>");
  });

  it("should render the fallback when the page does not provide the slot", async () => {
    const html = await render({
      default: () => h("div", "page"),
    });

    expect(html).toContain("<header><!--[-->fallback<!--]--></header>");
  });

  it("should not render the single-root page as a fragment", async () => {
    const Page = defineComponent(() => {
      return () => h("div", "page");
    });

    const html = await render({
      default: () => h(Page),
    });

    expect(html).toContain("<main><div>page</div></main>");
  });
});
