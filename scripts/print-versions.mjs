// Runs automatically before `npm run build` (npm "prebuild" hook) so build logs,
// including Railway's, show the real Node.js and npm versions used.
const npm = (process.env.npm_config_user_agent || "").match(/npm\/(\S+)/)?.[1] ?? "unknown";
console.log(`[build] Node.js ${process.version}, npm ${npm}, ${process.platform}/${process.arch}`);
