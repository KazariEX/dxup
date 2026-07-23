<script lang="ts" setup>
  definePageMeta({
    layout: "center",
  });
</script>

<!-- -------------- layout-slots -------------- -->

<!-- eslint-disable vue/valid-v-slot -->
<template>
  <template #[`outside`]="{ one }">
    <!--                    ^—^(definition) -->
    This "{{ one satisfies string }}" comes from the layout slot.
  </template>
  <div>
    About Page [
    <nuxt-link :to="{ name: `about` }">about</nuxt-link> /
    <nuxt-link :to="{ name: `contact` }">contact</nuxt-link>
    ]
  </div>
  <nuxt-page :transition="{ name: `fade`, appear: true }"/>
</template>

<style scoped>
  :where(.fade-enter-active, .fade-leave-active) {
    transition: opacity 0.5s;
  }

  :where(.fade-enter-from, .fade-leave-to) {
    opacity: 0;
  }
</style>
