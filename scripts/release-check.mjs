// Production release guard without building:
//   npm run release:check                 — evaluates the current environment
//   npm run release:check -- --production — as if this were the production build
// Exit code 1 when a production release would be refused.
import { runReleaseGuard } from "../lib/release-guard.mjs";

const forceProduction = process.argv.includes("--production");
const result = runReleaseGuard({ forceProduction });
if (result.blocked) {
  console.error(result.message);
  process.exit(1);
}
if (!result.production) console.log(`[release-guard] не production (${result.reason}) — блокировки нет.`);
