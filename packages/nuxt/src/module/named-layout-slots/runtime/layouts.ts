import { defineComponent, getCurrentInstance, h, inject, onScopeDispose, provide, shallowRef, type ShallowRef, type Slots } from "vue";
// @ts-expect-error virtual file
import { NuxtLayout } from "#build/dxup/layouts.mjs";

interface LayoutSlotsRegistry {
  slots: ShallowRef<Slots | null>;
  ready: Promise<void>;
  use: (slots: Slots) => void;
}

const injectionKey = Symbol.for("dxup:layout-slots");

export default defineComponent((props, ctx) => {
  const slots = shallowRef<Slots | null>(null);
  let resolveReady: () => void;

  provide<LayoutSlotsRegistry>(injectionKey, {
    slots,
    ready: new Promise((resolve) => {
      resolveReady = resolve;
    }),
    use(value) {
      // only allow top-level pages to forward slots
      slots.value ??= (
        onScopeDispose(() => {
          slots.value = null;
        }),
        value
      );
      resolveReady?.();
    },
  });

  return () => h(NuxtLayout, props, ctx.slots);
});

export const LayoutSlot = defineComponent({
  props: {
    name: {
      type: String,
      required: true,
    },
  },
  setup(props, ctx) {
    const { slots, ready } = inject<LayoutSlotsRegistry>(injectionKey)!;
    const currentInstance = getCurrentInstance();

    const render = () => (
      // for nested layouts or explicit imports,
      // the parent layout should be able to render the raw slots as fallback
      slots.value?.[props.name] ?? currentInstance?.parent?.slots[props.name]
    )?.(ctx.attrs);

    if (import.meta.server && !slots.value?.[props.name]) {
      return ready.then(() => render);
    }
    return render;
  },
});

export const LayoutSlotsForward = defineComponent((props, ctx) => {
  const { use } = inject<LayoutSlotsRegistry>(injectionKey)!;
  use(ctx.slots);

  return () => ctx.slots.default?.();
});
