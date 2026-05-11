import { defineComponent, inject, reactive, type ShallowRef, useSlots, watch } from "vue";
// @ts-expect-error virtual file
import { LayoutSlotsSymbol } from "#build/dxup/layouts.mjs";

export default defineComponent(() => {
    const slots = useSlots();
    const layoutSlots = inject(LayoutSlotsSymbol) as ShallowRef<typeof slots>;

    watch(reactive(slots), (val) => {
        layoutSlots.value = val;
    }, {
        immediate: true,
    });

    return () => slots.default?.();
});
