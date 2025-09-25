# @dxup/nuxt

[![version](https://img.shields.io/npm/v/@dxup/nuxt?color=007EC7&label=npm)](https://www.npmjs.com/package/@dxup/nuxt)
[![downloads](https://img.shields.io/npm/dm/@dxup/nuxt?color=007EC7&label=downloads)](https://www.npmjs.com/package/@dxup/nuxt)
[![license](https://img.shields.io/npm/l/@dxup/nuxt?color=007EC7&label=license)](/LICENSE)

This is a collection of TypeScript and Vue plugins that improves Nuxt DX.

## Features

- Go to definition for nitro routes on data fetching methods

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
