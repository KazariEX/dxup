# @dxup/nuxt

[![version](https://img.shields.io/npm/v/@dxup/nuxt?color=007EC7&label=npm)](https://www.npmjs.com/package/@dxup/nuxt)
[![downloads](https://img.shields.io/npm/dm/@dxup/nuxt?color=007EC7&label=downloads)](https://www.npmjs.com/package/@dxup/nuxt)
[![license](https://img.shields.io/npm/l/@dxup/nuxt?color=007EC7&label=license)](/LICENSE)

This is a TypeScript plugin that improves Nuxt DX.

> [!note]
> It's now an experimental builtin feature of Nuxt. Please refer to the [documentation](https://nuxt.com/docs/4.x/guide/going-further/experimental-features#typescriptplugin) for more details.

## Installation

*No installation is required if you are using Nuxt 4.2 or above.*

## Usage

1. Have `@dxup/unimport` installed as a dependency if you haven't enabled the `shamefullyHoist` option with pnpm workspace.

2. Add the following to your `nuxt.config.ts`:

   ```ts
   export default defineNuxtConfig({
     experimental: {
       typescriptPlugin: true,
     },
     dxup: {
       features: {
         // Enable opt-in features
         namedLayoutSlots: true,
       },
     },
   });
   ```

3. Run `nuxt prepare` and restart the tsserver.

## Features

### 1. components

Update references when renaming auto imported component files.

For example, when renaming `components/foo/bar.vue` to `components/foo/baz.vue`, all usages of `<FooBar />` will be updated to `<FooBaz />`.

It only works when the dev server is active.

### 2. importGlob

Go to definition for dynamic imports with glob patterns.

```ts
import(`~/assets/${name}.webp`);
//     ^^^^^^^^^^^^^^^^^^^^^^^
import.meta.glob("~/assets/*.webp");
//               ^^^^^^^^^^^^^^^^^
```

### 3. namedLayoutSlots

**Default:** `false`

Write top-level named slots in your pages:

```vue
<!-- layouts/center.vue -->
<template>
  <slot></slot>
  <slot name="side" one="one"></slot>
</template>
```

```vue
<!-- pages/about.vue -->
<script lang="ts" setup>
  definePageMeta({
    layout: "center",
  });
</script>

<template>
  <template #side="{ one }">
    This "{{ one }}" comes from the layout slot.
    <!--     ^^^ -->
  </template>
  <div>About Page</div>
</template>
```

And them will be forwarded to the active layout automatically.

### 4. nitroRoutes

Go to definition for nitro routes in data fetching methods.

```ts
useFetch("/api/foo");
//       ^^^^^^^^^^
// Also `$fetch` and `useLazyFetch`.
```

It will fallback to resolve the URL from your `public` directory when no nitro routes match.

### 5. pageMeta

Go to definition for page metadata.

```ts
definePageMeta({
  layout: "admin",
  //      ^^^^^^^
  middleware: ["auth"],
  //           ^^^^^^
});
```

### 6. runtimeConfig

Go to definition for runtime config.

```vue
<template>
  {{ $config.public.domain }}
  <!--              ^^^^^^ -->
</template>
```

### 7. typedPages

Go to definition for typed pages.

```vue
<template>
  <nuxt-link :to="{ name: `about` }"/>
  <!--                    ^^^^^^^ -->
</template>
```

It can be triggered on the `name` property of an object literal constrained by the `RouteLocationRaw` type.

### 8. unimport

Please refer to the [@dxup/unimport](/packages/unimport) package for more details.

### 9. unofficial

Find references for SFC on `<template>`.

```vue
....<template>
<!-- ^^^^^^^^ -->
</template>
```
