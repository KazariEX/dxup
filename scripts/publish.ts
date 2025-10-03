import { resolve } from "node:path";
import { $ } from "zx";

const tag = process.env.GITHUB_REF_NAME!;
const packageName = tag.split("@")[1].slice("dxup/".length);

await $({
    cwd: resolve(import.meta.dirname, "../packages", packageName),
})`pnpm publish --access public --no-git-checks`;
