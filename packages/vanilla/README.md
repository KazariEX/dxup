# @dxup/vanilla

[![version](https://img.shields.io/npm/v/@dxup/vanilla?color=007EC7&label=npm)](https://www.npmjs.com/package/@dxup/vanilla)
[![downloads](https://img.shields.io/npm/dm/@dxup/vanilla?color=007EC7&label=downloads)](https://www.npmjs.com/package/@dxup/vanilla)
[![license](https://img.shields.io/npm/l/@dxup/vanilla?color=007EC7&label=license)](/LICENSE)

This is a TypeScript plugin for Vanilla JS.

## Installation

```bash
pnpm i -D @dxup/vanilla
```

Or you can install the VS Code extension for easier setup:

```bash
code --install-extension KazariEX.dxup
```

## Usage

Add the following to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      { "name": "@dxup/vanilla" }
    ]
  }
}
```

## Features

### 1. signature

- Go to definition for signature parameters.

  ```ts
  export default defineConfig({
    plugins: [{
      name: "testify",
      transform(code, id, options) {
        //                ^^^^^^^
      },
    }],
  });
  ```

- Rewrite refactor for signature parameters.

  ```ts
  function swap(foo: number, bar: string, baz: boolean, qux: symbol) {}
  //                         ^^^ Refactor > Move parameter right
  swap(2, "3", true, Symbol(5));
  ```
