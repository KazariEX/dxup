<script setup lang="ts">
  definePageMeta({
    keepalive: true,
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
</script>

<!-- eslint-disable vue/valid-v-slot -->
<template>
  <template #panel>
    <span data-testid="panel-cached">Cached panel</span>
  </template>
  <div data-testid="page-cached">Cached page</div>
</template>
