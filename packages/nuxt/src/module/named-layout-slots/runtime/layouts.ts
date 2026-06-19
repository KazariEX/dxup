import { defineComponent, inject, provide, shallowRef, type ShallowRef, type Slots } from "vue";

interface LayoutSlotsRegistry {
  slots: ShallowRef<Slots>;
  set: (slots: Slots) => void;
  waitFor: (name: string) => Promise<void>;
}

const injectionKey = Symbol();

export function provideLayoutSlots() {
  const slots = shallowRef<Slots>({});
  // eslint-disable-next-line ts/no-unsafe-function-type
  const waiters = new Map<string, Function[]>();
  const registry: LayoutSlotsRegistry = {
    slots,
    set(value) {
      slots.value = value;
      for (const name of Object.keys(value)) {
        const resolves = waiters.get(name);
        if (!resolves?.length) {
          continue;
        }
        waiters.delete(name);
        for (const resolve of resolves) {
          resolve();
        }
      }
    },
    waitFor(name) {
      if (slots.value[name]) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        let resolves = waiters.get(name);
        if (!resolves) {
          waiters.set(name, resolves = []);
        }
        resolves.push(resolve);
      });
    },
  };
  provide(injectionKey, registry);
  return registry;
}

export const LayoutSlot = defineComponent({
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
    const registry = inject<LayoutSlotsRegistry>(injectionKey)!;
    const render = () => registry.slots.value[props.name]?.(props.props);

    if (import.meta.server && !registry.slots.value[props.name]) {
      return registry.waitFor(props.name).then(() => render);
    }
    return render;
  },
});

export const LayoutSlotsForward = defineComponent((props, ctx) => {
  const registry = inject<LayoutSlotsRegistry>(injectionKey)!;
  registry.set(ctx.slots);

  return () => ctx.slots.default?.();
});
