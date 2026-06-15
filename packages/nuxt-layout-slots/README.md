# @dxup/nuxt-layout-slots

[![version](https://img.shields.io/npm/v/@dxup/nuxt-layout-slots?color=007EC7&label=npm)](https://www.npmjs.com/package/@dxup/nuxt-layout-slots)
[![downloads](https://img.shields.io/npm/dm/@dxup/nuxt-layout-slots?color=007EC7&label=downloads)](https://www.npmjs.com/package/@dxup/nuxt-layout-slots)
[![license](https://img.shields.io/npm/l/@dxup/nuxt-layout-slots?color=007EC7&label=license)](/LICENSE)

This is a Nuxt module that provides named layout slots support.

## Installation

```bash
pnpm i -D @dxup/nuxt-layout-slots
```

## Usage

1. Add the following to your `nuxt.config.ts`:

   ```ts
   export default defineNuxtConfig({
     modules: [
       "@dxup/nuxt-layout-slots",
    ],
   });
   ```

2. Write top-level named slots in your pages directly:

   ```vue
   <!-- layouts/center.vue -->
   <template>
     <slot></slot>
     <slot name="side" one="one"></slot>
   </template>
   ```

   ```vue
   <!-- pages/about.vue -->
   <script setup lang="ts">
     definePageMeta({
       layout: "center",
     });
   </script>

   <template>
     <template #side="{ one }">
       {{ one }}
     </template>
     <div>About Page</div>
   </template>
   ```

   And them will be forwarded to the active layout.
