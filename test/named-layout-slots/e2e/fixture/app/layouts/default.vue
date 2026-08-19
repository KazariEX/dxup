<script setup lang="ts">
  import { injectionKey } from "../../../../../../packages/nuxt/src/module/named-layout-slots/runtime/registry";

  const pageSlots = useLayoutSlots();
  const hasPanel = computed(() => !!pageSlots.value.panel);

  const registry = inject(injectionKey)!;
  const events: { type: string; keys: string[] }[] = ((globalThis as any).__layoutSlotsEvents ??= []);

  const originalUse = registry.use;
  registry.use = (slots) => {
    events.push({ type: "use", keys: Object.keys(slots) });
    return originalUse(slots);
  };

  watch(pageSlots, (value) => {
    events.push({ type: "slots", keys: Object.keys(value) });
  }, { immediate: true, flush: "sync" });
</script>

<template>
  <div>
    <aside v-if="hasPanel" data-testid="sidebar">
      <panel-probe />
      <slot name="panel" ></slot>
    </aside>
    <aside v-if="pageSlots.aside" data-testid="aside">
      <slot name="aside" ></slot>
    </aside>
    <main>
      <slot ></slot>
    </main>
  </div>
</template>
