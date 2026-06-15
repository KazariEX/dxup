import { defineComponent, type ShallowRef, type Slots } from "vue";
// @ts-expect-error virtual file
import { injectLayoutSlots } from "#build/dxup/layouts.mjs";

export default defineComponent((props, ctx) => {
  const slots = injectLayoutSlots() as ShallowRef<Slots>;
  slots.value = ctx.slots;

  return () => ctx.slots.default?.();
});
