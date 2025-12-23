import { readFile } from "node:fs/promises";
import { versionBump } from "bumpp";
import { join } from "pathe";

const path = join(process.cwd(), "package.json");
const text = await readFile(path, "utf-8");
const name = JSON.parse(text).name;
const scope = name.slice("@dxup/".length);

await versionBump({
    push: false,
    tag: `${name}@%s`,
    commit: `release(${scope}): v%s`,
    files: scope === "vanilla"
        ? ["package.json", "../vscode/package.json"]
        : ["package.json"],
});
