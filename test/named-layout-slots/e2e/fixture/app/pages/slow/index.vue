<script setup lang="ts">
  await holdPage("slow");
</script>

<!-- eslint-disable vue/valid-v-slot -->
<template>
  <template #panel>
    <span data-testid="panel-slow">Slow</span>
  </template>
  <div data-testid="page-slow">Slow page</div>
</template>
