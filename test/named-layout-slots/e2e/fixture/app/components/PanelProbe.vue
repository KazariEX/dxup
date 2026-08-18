<script setup lang="ts">
  const events: { type: string; keys: string[] }[] = ((globalThis as any).__layoutSlotsEvents ??= []);

  onMounted(() => events.push({ type: "sidebar:mounted", keys: [] }));
  onUnmounted(() => events.push({ type: "sidebar:unmounted", keys: [] }));
</script>

<template>
  <span data-testid="probe" ></span>
</template>
