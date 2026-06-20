import { resolve } from "pathe";
import { exec } from "tinyexec";

const tag = process.env.GITHUB_REF_NAME!;
const packageName = tag.split("@")[1].slice("dxup/".length);

await exec("pnpm", ["publish", "--access", "public", "--no-git-checks"], {
  nodeOptions: {
    cwd: resolve(import.meta.dirname, "../packages", packageName),
  },
  throwOnError: true,
});
