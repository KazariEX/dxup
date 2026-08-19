import { computed, defineComponent, Fragment, getCurrentInstance, h, inject, onActivated, onDeactivated, onScopeDispose, onUpdated, provide, shallowRef, type Slots } from "vue";
// @ts-expect-error virtual file
import { NuxtLayout } from "#build/dxup/layouts.mjs";
import { injectionKey } from "./registry";

interface SlotsLayer {
  slots: Slots;
  uid: number;
}

export default defineComponent((props, ctx) => {
  const slots = shallowRef<Slots | null>(null);
  const layers: SlotsLayer[] = [];
  let layerUid = 0;
  let resolveReady: () => void;

  function update() {
    // a single active page needs no merging
    slots.value = layers.length > 1
      ? mergeLayers([...layers])
      : layers[0]?.slots ?? null;
  }

  provide(injectionKey, {
    slots,
    ready: new Promise<void>((resolve) => {
      resolveReady = resolve;
    }),
    use(value) {
      const layer: SlotsLayer = { slots: value, uid: layerUid++ };
      const add = () => {
        if (layers.some((entry) => entry.slots === value)) return;
        layers.push(layer);
        update();
      };
      const remove = () => {
        const index = layers.findIndex((entry) => entry.slots === value);
        if (index !== -1) {
          layers.splice(index, 1);
          update();
        }
      };

      add();
      // a page keeps providing its slots until it is unmounted,
      // so a navigation only switches the slots once the next page has settled
      onScopeDispose(remove);
      // a page cached by <KeepAlive> must not provide slots while inactive
      onDeactivated(remove);
      onActivated(add);
      resolveReady?.();
    },
    invalidate() {
      // always expose a fresh object; reactivity propagates correctly only on identity change
      slots.value = layers.length ? mergeLayers([...layers]) : null;
    },
    getOwner(name) {
      for (let i = layers.length - 1; i >= 0; i--) {
        if (layers[i].slots[name]) {
          return layers[i].uid;
        }
      }
    },
  });

  return () => h(NuxtLayout, props, ctx.slots);
});

/**
 * Merges the slots of all mounted pages. The most recently mounted pages have
 * a higher priority.
 * @param layers
 */
function mergeLayers(layers: SlotsLayer[]): Slots {
  const merged: Slots = {};
  for (let i = layers.length - 1; i >= 0; i--) {
    for (const key in layers[i].slots) {
      if (!(key in merged)) {
        Object.defineProperty(merged, key, {
          enumerable: true,
          configurable: true,
          // resolve lazily, so re-rendered pages provide their current slot functions
          get: () => {
            for (let j = layers.length - 1; j >= 0; j--) {
              const slot = layers[j].slots[key];
              if (slot) {
                return slot;
              }
            }
          },
        });
      }
    }
  }
  return merged;
}

/**
 * Returns the slots forwarded by the active page via named layout slots.
 */
export function useLayoutSlots() {
  const registry = inject(injectionKey, null);
  return computed(() => registry?.slots.value ?? {});
}

export const LayoutSlot = defineComponent({
  props: {
    name: {
      type: String,
      required: true,
    },
  },
  setup(props, ctx) {
    const registry = inject(injectionKey);
    const currentInstance = getCurrentInstance();

    const render = () => {
      const slot =
        // for nested layouts or explicit imports,
        // the parent layout should be able to render the raw slots as fallback
        registry?.slots.value?.[props.name] ?? currentInstance?.parent?.slots[props.name];
      // an unprovided slot falls back to the children of the original `<slot>`
      const children = slot?.(ctx.attrs) ?? ctx.slots.default?.();
      // key the content by the forward that provides it, so it lives and dies
      // with its page instead of being patched across page boundaries
      return h(Fragment, { key: registry?.getOwner(props.name) ?? -1 }, children ?? []);
    };

    if (import.meta.server && registry && !registry.slots.value?.[props.name]) {
      return registry.ready.then(() => render);
    }
    return render;
  },
});

export const LayoutSlotsForward = defineComponent((props, ctx) => {
  const registry = inject(injectionKey);

  registry?.use(ctx.slots);

  // invalidate the registry when conditional slots are re-rendered (`ctx.slots` is mutated in place)
  if (import.meta.client && registry) {
    let keys = Object.keys(ctx.slots).join("\0");
    onUpdated(() => {
      const next = Object.keys(ctx.slots).join("\0");
      if (next !== keys) {
        keys = next;
        registry.invalidate();
      }
    });
  }

  return () => {
    const vnodes = ctx.slots.default?.();
    // do not break the single-root structure of page components
    return vnodes?.length === 1 ? vnodes[0] : vnodes;
  };
});
