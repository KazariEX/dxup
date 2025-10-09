# @dxup/nuxt

[![version](https://img.shields.io/npm/v/@dxup/nuxt?color=007EC7&label=npm)](https://www.npmjs.com/package/@dxup/nuxt)
[![downloads](https://img.shields.io/npm/dm/@dxup/nuxt?color=007EC7&label=downloads)](https://www.npmjs.com/package/@dxup/nuxt)
[![license](https://img.shields.io/npm/l/@dxup/nuxt?color=007EC7&label=license)](/LICENSE)

This is a TypeScript plugin that improves Nuxt DX.

## Features

- Update references when renaming auto imported component files
- Go to definition for nitro routes in data fetching methods
- Go to definition for runtime config
- [@dxup/unimport](/packages/unimport)

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
