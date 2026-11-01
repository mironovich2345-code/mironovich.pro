// Local production build that is not a release: bakes in http://localhost:3000
// as the site URL, so the release guard only reports and does not block.
//   npm run build:local
import { spawnSync } from "node:child_process";

const env = { ...process.env, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000" };
const r = spawnSync("npx", ["next", "build"], { stdio: "inherit", env, shell: process.platform === "win32" });
process.exit(r.status ?? 1);
