import { type ComponentInternalInstance, computed, defineComponent, getCurrentInstance, h, inject, onScopeDispose, provide, shallowRef, type ShallowRef, type Slots } from "vue";
// @ts-expect-error virtual file
import { NuxtLayout } from "#build/dxup/layouts.mjs";

interface LayoutSlotsRegistry {
  slots: ShallowRef<Slots | null>;
  ready: Promise<void>;
  use: (slots: Slots, owner: ComponentInternalInstance | null) => void;
}

const injectionKey = Symbol.for("dxup:layout-slots");

export default defineComponent((props, ctx) => {
  const slots = shallowRef<Slots | null>(null);
  let currentOwner: ComponentInternalInstance | null = null;
  let resolveReady: () => void;

  provide<LayoutSlotsRegistry>(injectionKey, {
    slots,
    ready: new Promise((resolve) => {
      resolveReady = resolve;
    }),
    use(value, owner) {
      // a nested page must not override the slots of its top-level page
      if (currentOwner) {
        for (let parent = owner?.parent; parent; parent = parent.parent) {
          if (parent === currentOwner) {
            return;
          }
        }
      }

      slots.value = value;
      currentOwner = owner;
      onScopeDispose(() => {
        // the next page can finish setup before this page is disposed
        // in that case, the old page no longer owns the registry and must not clear it
        if (currentOwner === owner) {
          slots.value = null;
          currentOwner = null;
        }
      });
      resolveReady?.();
    },
  });

  return () => h(NuxtLayout, props, ctx.slots);
});

/**
 * Returns the slots forwarded by the active page via named layout slots.
 */
export function useLayoutSlots() {
  const registry = inject<LayoutSlotsRegistry | null>(injectionKey, null);
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
    const registry = inject<LayoutSlotsRegistry>(injectionKey);
    const currentInstance = getCurrentInstance();

    const render = () => {
      const slot =
        // for nested layouts or explicit imports,
        // the parent layout should be able to render the raw slots as fallback
        registry?.slots.value?.[props.name] ?? currentInstance?.parent?.slots[props.name];
      // an unprovided slot falls back to the children of the original `<slot>`
      return slot?.(ctx.attrs) ?? ctx.slots.default?.();
    };

    if (import.meta.server && registry && !registry.slots.value?.[props.name]) {
      return registry.ready.then(() => render);
    }
    return render;
  },
});

export const LayoutSlotsForward = defineComponent((props, ctx) => {
  const registry = inject<LayoutSlotsRegistry>(injectionKey);
  const currentInstance = getCurrentInstance();

  registry?.use(ctx.slots, currentInstance);

  return () => {
    const vnodes = ctx.slots.default?.();
    // do not break the single-root structure of page components
    return vnodes?.length === 1 ? vnodes[0] : vnodes;
  };
});
