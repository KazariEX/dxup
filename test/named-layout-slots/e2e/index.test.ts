import { mountSuspended } from "@nuxt/test-utils/runtime";
import { navigateTo } from "nuxt/app";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./fixture/app/app.vue";

interface SlotsEvent {
  type: string;
  keys: string[];
}

const events: SlotsEvent[] = ((globalThis as any).__layoutSlotsEvents ??= []);

/** Records the events emitted from this point on */
function recordEvents() {
  const start = events.length;
  const since = () => events.slice(start);

  return {
    ofType: (type: string) => since().filter((event) => event.type === type),
    getTypes: () => since().map((event) => event.type),
    /** The slot keys the layout resolved most recently */
    getCurrentSlotKeys: () => since().filter((event) => event.type === "slots").at(-1)?.keys ?? [],
  };
}

const pageGates = ((globalThis as any).__pageGates ??= new Map()) as Map<string, (() => void)[]>;

function releasePage(key: string) {
  for (const resolve of pageGates.get(key)?.splice(0) ?? []) {
    resolve();
  }
}

function releaseAllPages() {
  for (const key of pageGates.keys()) {
    releasePage(key);
  }
}

/** Waits until the gated page is mounted and awaiting its setup */
async function waitForPendingPage(key: string) {
  await vi.waitFor(() => {
    expect(pageGates.get(key)?.length ?? 0).toBeGreaterThan(0);
  });
}

describe("named layout slots navigation", () => {
  let wrapper: Awaited<ReturnType<typeof mountSuspended>>;

  /** Opens the nested detail page, which provides the `panel` slot. */
  async function openPageWithSlot(id: number) {
    await navigateTo(`/nested/${id}`);
    await vi.waitFor(() => {
      expect(wrapper.find(`[data-testid="panel-detail"]`).text()).toBe(`Detail ${id}`);
    });
  }

  /** Opens a page that provides no slot, so the layout hides it. */
  async function openPageWithoutSlot() {
    await navigateTo("/nested");
    await vi.waitFor(() => {
      expect(wrapper.find(`[data-testid="page-no-slot"]`).exists()).toBe(true);
      expect(wrapper.find(`[data-testid="sidebar"]`).exists()).toBe(false);
    });
  }

  beforeEach(async () => {
    await navigateTo("/");
    wrapper = await mountSuspended(App);
    await vi.waitFor(() => {
      expect(wrapper.find(`[data-testid="page-home"]`).exists()).toBe(true);
    });
  });

  afterEach(() => {
    releaseAllPages();
    wrapper?.unmount();
  });

  it("should show the page slot of a nested page", async () => {
    expect(wrapper.find(`[data-testid="sidebar"]`).exists()).toBe(false);

    await openPageWithSlot(1);
  });

  it("should not hide the page slot while the next page is loading", async () => {
    await openPageWithSlot(1);

    const recorded = recordEvents();
    await navigateTo("/slow");
    await waitForPendingPage("slow");

    // the existing page keeps providing its slot while the new page's setup is pending
    expect(wrapper.find(`[data-testid="sidebar"]`).text()).toContain("Detail 1");
    expect(wrapper.find(`[data-testid="page-detail"]`).exists()).toBe(true);
    // and its slot content stays mounted
    expect(recorded.getTypes()).not.toContain("content:unmounted");

    // the slot swaps once the setup resolves and the new page mounts
    releasePage("slow");
    await vi.waitFor(() => {
      expect(wrapper.find(`[data-testid="page-slow"]`).exists()).toBe(true);
      expect(wrapper.find(`[data-testid="sidebar"]`).text()).toContain("Slow");
    });
    expect(wrapper.find(`[data-testid="sidebar"]`).text()).not.toContain("Detail 1");

    for (const event of recorded.ofType("slots")) {
      expect(event.keys).toContain("panel");
    }
    expect(recorded.getTypes()).not.toContain("sidebar:unmounted");
  });

  it("should hide the page slot when the next page does not provide one", async () => {
    await openPageWithSlot(1);

    const recorded = recordEvents();
    await openPageWithoutSlot();

    expect(recorded.getCurrentSlotKeys()).not.toContain("panel");
  });

  it("should show the page slot again when returning to a page that provides one", async () => {
    await openPageWithSlot(1);
    await openPageWithoutSlot();

    await openPageWithSlot(2);
  });

  it("should stay consistent when a navigation is interrupted", async () => {
    const interrupted = navigateTo("/slow");
    // cancel navigation while the slow page is still loading
    await navigateTo("/nested");
    await interrupted;

    releasePage("slow");

    await vi.waitFor(() => {
      expect(wrapper.find(`[data-testid="page-no-slot"]`).exists()).toBe(true);
    });

    // the aborted page must not leave a rendered slot
    expect(wrapper.find(`[data-testid="sidebar"]`).exists()).toBe(false);
  });

  it("should hide and restore the page slot of a page kept alive in the background", async () => {
    await navigateTo("/cached");
    await vi.waitFor(() => {
      expect(wrapper.find(`[data-testid="panel-cached"]`).exists()).toBe(true);
    });

    // deactivating the kept-alive page must remove its slots
    await openPageWithoutSlot();

    // reactivating it must provide them again
    await navigateTo("/cached");
    await vi.waitFor(() => {
      expect(wrapper.find(`[data-testid="panel-cached"]`).exists()).toBe(true);
    });
  });

  it("should remount the slot content when the providing page changes", async () => {
    await openPageWithSlot(1);
    await wrapper.find(`[data-testid="content-state"]`).trigger("click");
    expect(wrapper.find(`[data-testid="content-state"]`).text()).toBe("dirty");

    const recorded = recordEvents();
    await openPageWithSlot(2);

    // the state belongs to the page, so it must not carry state across pages
    expect(recorded.getTypes()).toContain("content:unmounted");
    expect(wrapper.find(`[data-testid="content-state"]`).text()).toBe("clean");
  });

  it("should keep the slot content instance when the providing page re-renders its slots", async () => {
    await navigateTo("/multi");
    await vi.waitFor(() => {
      expect(wrapper.find(`[data-testid="page-multi"]`).exists()).toBe(true);
    });
    await wrapper.find(`[data-testid="content-state"]`).trigger("click");

    const recorded = recordEvents();
    // toggling another conditional slot invalidates the page's forwarded slots
    await wrapper.find(`[data-testid="toggle-aside"]`).trigger("click");
    await vi.waitFor(() => {
      expect(wrapper.find(`[data-testid="aside-content"]`).exists()).toBe(true);
    });

    expect(recorded.getTypes()).not.toContain("content:unmounted");
    expect(wrapper.find(`[data-testid="content-state"]`).text()).toBe("dirty");
  });

  it("should update the page slot when a page toggles it conditionally", async () => {
    await navigateTo("/toggle");
    await vi.waitFor(() => {
      expect(wrapper.find(`[data-testid="panel-toggle"]`).exists()).toBe(true);
    });

    // hiding the slot must remove it
    await wrapper.find(`[data-testid="toggle"]`).trigger("click");
    await vi.waitFor(() => {
      expect(wrapper.find(`[data-testid="sidebar"]`).exists()).toBe(false);
    });

    // showing it again must bring it back
    await wrapper.find(`[data-testid="toggle"]`).trigger("click");
    await vi.waitFor(() => {
      expect(wrapper.find(`[data-testid="panel-toggle"]`).exists()).toBe(true);
    });
  });
});
