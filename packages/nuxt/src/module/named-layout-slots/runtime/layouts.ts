import { defineComponent, h, inject, provide, shallowRef, type ShallowRef, type Slots } from "vue";
// @ts-expect-error virtual file
import { NuxtLayout } from "#build/dxup/layouts.mjs";

interface LayoutSlotsRegistry {
  slots: ShallowRef<Slots>;
  ready: Promise<void>;
  set: (slots: Slots) => void;
}

const injectionKey = Symbol();

export default defineComponent((props, ctx) => {
  const slots = shallowRef<Slots>({});
  let resolveReady: () => void;

  provide<LayoutSlotsRegistry>(injectionKey, {
    slots,
    ready: new Promise((resolve) => {
      resolveReady = resolve;
    }),
    set(value) {
      slots.value = value;
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
    const render = () => slots.value[props.name]?.(ctx.attrs);

    if (import.meta.server && !slots.value[props.name]) {
      return ready.then(() => render);
    }
    return render;
  },
});

export const LayoutSlotsForward = defineComponent((props, ctx) => {
  const { set } = inject<LayoutSlotsRegistry>(injectionKey)!;
  set(ctx.slots);

  return () => ctx.slots.default?.();
});
