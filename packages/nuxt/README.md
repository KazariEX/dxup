# @dxup/nuxt

[![version](https://img.shields.io/npm/v/@dxup/nuxt?color=007EC7&label=npm)](https://www.npmjs.com/package/@dxup/nuxt)
[![downloads](https://img.shields.io/npm/dm/@dxup/nuxt?color=007EC7&label=downloads)](https://www.npmjs.com/package/@dxup/nuxt)
[![license](https://img.shields.io/npm/l/@dxup/nuxt?color=007EC7&label=license)](/LICENSE)

This is a TypeScript plugin that improves Nuxt DX.

## Installation

```bash
pnpm i -D @dxup/nuxt
```

## Usage

Add the following to your `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: [
    "@dxup/nuxt",
  ],
});
```

## Features

### components

Update references when renaming auto imported component files.

### importGlob

Go to definition for dynamic imports with glob patterns.

```ts
import(`~/assets/${name}.webp`);
//     ^^^^^^^^^^^^^^^^^^^^^^^
import.meta.glob("~/assets/*.webp");
//               ^^^^^^^^^^^^^^^^^
```

### nitroRoutes

Go to definition for nitro routes in data fetching methods.

```ts
useFetch("/api/foo");
//       ^^^^^^^^^^
// Also `$fetch` and `useLazyFetch`.
```

It will fallback to resolve the URL from your `public` directory when no nitro routes match.

### runtimeConfig

Go to definition for runtime config.

```vue
<template>
  {{ $config.public.domain }}
  <!--              ^^^^^^ -->
</template>
```

### unimport

Please refer to the [@dxup/unimport](/packages/unimport) package for more details.
