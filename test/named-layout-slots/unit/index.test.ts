import { describe, expect, it } from "vitest";
import { type Component, type ComputedRef, defineComponent, h, inject, type Slots } from "vue";
import { renderToString } from "vue/server-renderer";
import NuxtLayout, { LayoutSlot, LayoutSlotsForward, useLayoutSlots } from "../../../packages/nuxt/src/module/named-layout-slots/runtime/layouts";
import { injectionKey, type LayoutSlotsRegistry } from "../../../packages/nuxt/src/module/named-layout-slots/runtime/registry";

const DefaultLayout = defineComponent((props, ctx) => {
  return () => [
    h("header", [
      h(LayoutSlot, { name: "header" }, () => "fallback"),
    ]),
    h("main", ctx.slots.default?.()),
  ];
});

function renderForwarded(layout: Component, page: Record<string, unknown>) {
  return renderToString(
    h(NuxtLayout, null, {
      default: () => h(layout, null, {
        default: () => h(LayoutSlotsForward, null, page),
      }),
    }),
  );
}

describe("named layout slots", () => {
  it("should prefer the slot provided by the page", async () => {
    const html = await renderForwarded(DefaultLayout, {
      default: () => h("div", "page"),
      header: () => "from page",
    });

    expect(html).toContain("<header><!--[-->from page<!--]--></header>");
  });

  it("should render the fallback when the page does not provide the slot", async () => {
    const html = await renderForwarded(DefaultLayout, {
      default: () => h("div", "page"),
    });

    expect(html).toContain("<header><!--[-->fallback<!--]--></header>");
  });

  it("should not render the single-root page as a fragment", async () => {
    const Page = defineComponent(() => {
      return () => h("div", "page");
    });

    const html = await renderForwarded(DefaultLayout, {
      default: () => h(Page),
    });

    expect(html).toContain("<main><div>page</div></main>");
  });

  it("should prefer the innermost forward when nested pages provide the same slot", async () => {
    const html = await renderForwarded(DefaultLayout, {
      default: () => h(LayoutSlotsForward, null, {
        default: () => h("div", "child"),
        header: () => "from child",
      }),
      header: () => "from parent",
    });

    expect(html).toContain("<header><!--[-->from child<!--]--></header>");
  });

  it("should keep the outer slots when a nested forward does not provide them", async () => {
    const html = await renderForwarded(DefaultLayout, {
      default: () => h(LayoutSlotsForward, null, {
        default: () => h("div", "child"),
      }),
      header: () => "from parent",
    });

    expect(html).toContain("<header><!--[-->from parent<!--]--></header>");
  });

  it("should resolve merged slots from the live slots of a re-rendered page", async () => {
    let slots!: ComputedRef<Slots>;
    const pageSlots: Record<string, () => string> = {
      header: () => "before",
    };

    const InnerPage = defineComponent(() => {
      const registry = inject(injectionKey)!;
      // @ts-expect-error `() => string` is not assignable to `Slot`
      registry.use(pageSlots);
      return () => h("div", "page");
    });

    const Layout = defineComponent((props, ctx) => {
      slots = useLayoutSlots();
      return () => h("main", ctx.slots.default?.());
    });

    await renderForwarded(Layout, {
      default: () => h(LayoutSlotsForward, null, {
        default: () => h(InnerPage),
        header: () => "outer",
      }),
    });

    pageSlots.header = () => "after";

    expect(slots.value.header?.()).toBe("after");
  });

  it("should attribute a slot to the innermost forward providing it", async () => {
    let registry!: LayoutSlotsRegistry;

    const Layout = defineComponent((props, ctx) => {
      registry = inject(injectionKey)!;
      return () => h("main", ctx.slots.default?.());
    });

    await renderForwarded(Layout, {
      default: () => h(LayoutSlotsForward, null, {
        default: () => h("div", "child"),
        header: () => "from child",
      }),
      header: () => "from parent",
      footer: () => "from parent",
    });

    const headerOwner = registry.getOwner("header");
    expect(headerOwner).toBeDefined();
    // the child forward owns the slots it provides, including the shared ones
    expect(registry.getOwner("default")).toBe(headerOwner);
    // the parent forward owns only the slots the child does not provide
    expect(registry.getOwner("footer")).not.toBe(headerOwner);
    expect(registry.getOwner("missing")).toBeUndefined();
  });

  it("should move the ownership when the innermost forward stops providing a slot", async () => {
    let registry!: LayoutSlotsRegistry;
    const pageSlots: Record<string, (() => string) | undefined> = {
      header: () => "inner",
    };

    const InnerPage = defineComponent(() => {
      registry.use(pageSlots as Slots);
      return () => h("div", "page");
    });

    const Layout = defineComponent((props, ctx) => {
      registry = inject(injectionKey)!;
      return () => h("main", ctx.slots.default?.());
    });

    await renderForwarded(Layout, {
      default: () => h(InnerPage),
      header: () => "outer",
      footer: () => "outer",
    });

    const innerOwner = registry.getOwner("header");
    const outerOwner = registry.getOwner("footer");
    expect(innerOwner).not.toBe(outerOwner);

    delete pageSlots.header;
    registry.invalidate();

    expect(registry.getOwner("header")).toBe(outerOwner);
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

  it("should render an empty layout slot without fallback", async () => {
    const render = () => renderToString(
      h(LayoutSlot, { name: "header" }),
    );

    expect(render()).resolves.not.toThrow();
  });

  it("should expose the slots provided by the page via useLayoutSlots", async () => {
    let slots!: ComputedRef<Slots>;

    const Layout = defineComponent((props, ctx) => {
      slots = useLayoutSlots();
      return () => h("main", ctx.slots.default?.());
    });

    await renderForwarded(Layout, {
      default: () => h("div", "page"),
      header: () => "from page",
    });

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
