<script setup lang="ts">
  const id = useRoute().params.id;

  await new Promise((resolve) => setTimeout(resolve, 0));
</script>

<!-- eslint-disable vue/valid-v-slot -->
<template>
  <template #panel>
    <span data-testid="panel-detail">Detail {{ id }}</span>
    <content-probe />
  </template>
  <div data-testid="page-detail">Detail</div>
</template>
