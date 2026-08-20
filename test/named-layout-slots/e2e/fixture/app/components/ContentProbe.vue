<script setup lang="ts">
  const events: { type: string; keys: string[] }[] = ((globalThis as any).__layoutSlotsEvents ??= []);

  const dirty = ref(false);

  onMounted(() => events.push({ type: "content:mounted", keys: [] }));
  onUnmounted(() => events.push({ type: "content:unmounted", keys: [] }));
</script>

<template>
  <button data-testid="content-state" @click="dirty = true">{{ dirty ? "dirty" : "clean" }}</button>
</template>
