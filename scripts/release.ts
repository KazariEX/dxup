import { readFile } from "node:fs/promises";
import { versionBump } from "bumpp";
import { join } from "pathe";

const path = join(process.cwd(), "package.json");
const text = await readFile(path, "utf-8");
const { name } = JSON.parse(text);

await versionBump({
    push: false,
    tag: `${name}@%s`,
    commit: `release(${name.slice("@dxup/".length)}): v%s`,
});
