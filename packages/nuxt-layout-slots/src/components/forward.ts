import { defineComponent, inject, type Ref } from "vue";
// @ts-expect-error virtual file
import { LayoutSlotsSymbol } from "#build/dxup/layouts.mjs";

export default defineComponent((props, ctx) => {
    const slots = inject(LayoutSlotsSymbol) as Ref<typeof ctx.slots>;
    slots.value = ctx.slots;

    return () => ctx.slots.default?.();
});
