import { defineComponent, h, inject, provide, shallowRef, type ShallowRef, type Slots } from "vue";
// @ts-expect-error virtual file
import { NuxtLayout } from "#build/dxup/layouts.mjs";
// @ts-expect-error runtime alias
import { useRoute } from "#imports";

interface LayoutSlotsRegistry {
  slots: ShallowRef<Slots>;
  ready: Promise<void>;
  set: (slots: Slots) => void;
}

const injectionKey = Symbol();

export default defineComponent((props, ctx) => {
  const route = useRoute();
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

  return () => h(NuxtLayout, props, {
    ...ctx.slots,
    ...Object.fromEntries(
      route.meta.layoutSlots?.map((name: string) => [
        name,
        // eslint-disable-next-line ts/no-use-before-define
        (props: Record<string, any>) => h(LayoutSlot, { name, props }),
      ]) ?? [],
    ),
  });
});

const LayoutSlot = defineComponent({
  props: {
    name: {
      type: String,
      required: true,
    },
    props: {
      type: Object,
      default: () => ({}),
    },
  },
  setup(props) {
    const { slots, ready } = inject<LayoutSlotsRegistry>(injectionKey)!;
    const render = () => slots.value[props.name]?.(props.props);

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
