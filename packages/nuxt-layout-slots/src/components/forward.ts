import { defineComponent, inject, type ShallowRef, type Slots } from "vue";
// @ts-expect-error virtual file
import { LayoutSlotsSymbol } from "#build/dxup/layouts.mjs";

export default defineComponent((props, ctx) => {
    const slots = inject(LayoutSlotsSymbol) as ShallowRef<Slots>;
    slots.value = ctx.slots;

    return () => ctx.slots.default?.();
});
