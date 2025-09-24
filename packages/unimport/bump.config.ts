import { defineConfig } from "bumpp";
import { name } from "./package.json";

export default defineConfig({
    push: false,
    tag: `${name}@%s`,
    commit: `release(${name.slice("@dxup/".length)}): v%s`,
});
