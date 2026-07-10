<script setup lang="ts">
  import Default from "./default.vue";
</script>

<template>
  <!-- cannot use `<nuxt-layout name="default"/>` since it has not been fully typed -->
  <default>
    <slot></slot>
    <template #inside="props">
      <slot name="outside" v-bind="props"></slot>
    </template>
  </default>
</template>
