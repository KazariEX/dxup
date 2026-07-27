import { defineComponent } from "vue";

export const NuxtLayout = defineComponent((_props, ctx) => {
  return () => ctx.slots.default?.();
});
