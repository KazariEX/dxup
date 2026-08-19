<script setup lang="ts">
  const showAside = ref(false);

  await new Promise((resolve) => setTimeout(resolve, 0));
</script>

<!-- eslint-disable vue/valid-v-slot -->
<template>
  <template #panel>
    <content-probe />
  </template>
  <template v-if="showAside" #aside>
    <span data-testid="aside-content">Aside</span>
  </template>
  <button data-testid="toggle-aside" @click="showAside = !showAside">aside</button>
  <div data-testid="page-multi">Multi page</div>
</template>
