import { defineComponent } from "vue";

export const NuxtLayout = defineComponent((props, ctx) => {
  return () => ctx.slots.default?.();
});
