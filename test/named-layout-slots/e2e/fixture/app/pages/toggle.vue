<script setup lang="ts">
  const show = ref(true);

  await new Promise((resolve) => setTimeout(resolve, 0));
</script>

<!-- eslint-disable vue/valid-v-slot -->
<template>
  <template v-if="show" #panel>
    <span data-testid="panel-toggle">Toggle panel</span>
  </template>
  <button data-testid="toggle" @click="show = !show">toggle</button>
  <div data-testid="page-toggle">Toggle page</div>
</template>
