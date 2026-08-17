import { describe, expect, it } from "vitest";
import { type ComputedRef, defineComponent, h, type Slots } from "vue";
import { renderToString } from "vue/server-renderer";
import NuxtLayout, { LayoutSlot, LayoutSlotsForward, useLayoutSlots } from "../../packages/nuxt/src/module/named-layout-slots/runtime/layouts";

const DefaultLayout = defineComponent((props, ctx) => {
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
      default: () => h(DefaultLayout, null, {
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

  it("should render a page without a layout", async () => {
    const render = () => renderToString(
      h(LayoutSlotsForward, null, {
        default: () => h("div", "page"),
      }),
    );

    expect(render()).resolves.not.toThrow();
  });

  it("should render a layout slot fallback without a layout provider", async () => {
    const render = () => renderToString(
      h(LayoutSlot, { name: "header" }, () => "fallback"),
    );

    expect(render()).resolves.not.toThrow();
  });

  it("should expose the slots provided by the page via useLayoutSlots", async () => {
    let slots!: ComputedRef<Slots>;

    const Layout = defineComponent((props, ctx) => {
      slots = useLayoutSlots();
      return () => h("main", ctx.slots.default?.());
    });

    await renderToString(
      h(NuxtLayout, null, {
        default: () => h(Layout, null, {
          default: () => h(LayoutSlotsForward, null, {
            default: () => h("div", "page"),
            header: () => "from page",
          }),
        }),
      }),
    );

    expect(Object.keys(slots.value)).toEqual(["default", "header"]);
  });

  it("should return empty slots via useLayoutSlots without a layout provider", async () => {
    let slots!: ComputedRef<Slots>;

    await renderToString(
      h(defineComponent(() => {
        slots = useLayoutSlots();
        return () => h("div", "page");
      })),
    );

    expect(slots.value).toEqual({});
  });
});
