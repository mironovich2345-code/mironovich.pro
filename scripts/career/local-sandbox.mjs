#!/usr/bin/env node
// Local-only synthetic career sandbox. Uses ephemeral PostgreSQL in Docker;
// all payment/SMTP responses are in-memory fixtures. No real API credentials.
import { randomBytes } from "node:crypto";
import {
  chmodSync, existsSync, readFileSync, writeFileSync,
} from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../..", import.meta.url));
const envPath = path.join(root, ".env.career.local");
const composePath = path.join(root, "docker-compose.career-local.yml");
const command = process.argv[2] || "help";
const hex = (n = 32) => randomBytes(n).toString("hex");
const fail = (reason) => { throw new Error("[career-local] " + reason); };

function init() {
  if (existsSync(envPath)) {
    console.log("[career-local] Existing local config was not changed.");
    return;
  }
  const password = hex(24);
  const values = {
    CAREER_SANDBOX_ENABLED: "1",
    CAREER_ENVIRONMENT: "synthetic-sandbox",
    CAREER_ONLY_SYNTHETIC: "true",
    CAREER_APP_ORIGIN: "http://127.0.0.1:3300",
    CAREER_DATABASE_URL: "postgresql://career_sandbox:" + password + "@127.0.0.1:55433/mironovich_career_test",
    CAREER_DATABASE_NAME: "mironovich_career_test",
    CAREER_DATABASE_HOST: "127.0.0.1:55433",
    CAREER_DB_PASSWORD: password,
    CAREER_SESSION_SECRET: hex(40),
    CAREER_TESTER_SECRET: hex(32),
    CAREER_PAYMENT_MODE: "fixture",
    YOOKASSA_SHOP_ID: "1534248",
    YOOKASSA_TEST_SECRET_KEY: "test_" + hex(24),
    YOOKASSA_TEST_KEY_ROTATED: "false",
    CAREER_PROVIDER_FIXTURE_URL: "http://127.0.0.1:3305",
    CAREER_FIXTURE_CONTROL_SECRET: hex(32),
    CAREER_SMTP_READY: "true",
    CAREER_SMTP_HOST: "127.0.0.1",
    CAREER_SMTP_PORT: "2526",
    CAREER_AI_MODE: "rules",
    CAREER_AI_ENABLED: "0",
    OPENAI_API_KEY: "",
    NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3300",
    NEXT_PUBLIC_YANDEX_METRICA_ID: "",
    SITE_NOINDEX: "true",
  };
  writeFileSync(envPath, Object.entries(values).map(([k, v]) => k + "=" + v).join("\n") + "\n", { flag: "wx", mode: 0o600 });
  try { chmodSync(envPath, 0o600); } catch { /* Windows ACLs are managed by the user */ }
  console.log("[career-local] Created ignored synthetic configuration; secrets are not printed.");
}
function readConfig() {
  if (!existsSync(envPath)) fail("Run npm run career:local:init first.");
  const entries = readFileSync(envPath, "utf8").split(/\r?\n/).filter(Boolean);
  const config = {};
  for (const row of entries) {
    const eq = row.indexOf("=");
    if (eq < 1) fail("Malformed local configuration.");
    const key = row.slice(0, eq);
    if (!/^[A-Z0-9_]+$/.test(key) || Object.hasOwn(config, key)) fail("Invalid or repeated local setting.");
    config[key] = row.slice(eq + 1);
  }
  const expected = {
    CAREER_SANDBOX_ENABLED: "1",
    CAREER_ENVIRONMENT: "synthetic-sandbox",
    CAREER_ONLY_SYNTHETIC: "true",
    CAREER_APP_ORIGIN: "http://127.0.0.1:3300",
    CAREER_DATABASE_NAME: "mironovich_career_test",
    CAREER_DATABASE_HOST: "127.0.0.1:55433",
    CAREER_PAYMENT_MODE: "fixture",
    CAREER_PROVIDER_FIXTURE_URL: "http://127.0.0.1:3305",
    CAREER_SMTP_HOST: "127.0.0.1",
    CAREER_SMTP_PORT: "2526",
    CAREER_AI_MODE: "rules",
    CAREER_AI_ENABLED: "0",
    OPENAI_API_KEY: "",
  };
  for (const [key, value] of Object.entries(expected))
    if (config[key] !== value) fail("Unsafe or unsupported local setting: " + key);
  if (
    config.CAREER_DATABASE_URL !==
      "postgresql://career_sandbox:" + config.CAREER_DB_PASSWORD + "@127.0.0.1:55433/mironovich_career_test" ||
    !/^[a-f0-9]{48}$/.test(config.CAREER_DB_PASSWORD || "") ||
    !/^[a-f0-9]{80}$/.test(config.CAREER_SESSION_SECRET || "") ||
    !/^[a-f0-9]{64}$/.test(config.CAREER_TESTER_SECRET || "") ||
    !/^[a-f0-9]{64}$/.test(config.CAREER_FIXTURE_CONTROL_SECRET || "") ||
    !/^test_[a-f0-9]{48}$/.test(config.YOOKASSA_TEST_SECRET_KEY || "")
  ) fail("Local secrets or isolated database configuration are invalid.");
  if (config.YOOKASSA_TEST_KEY_ROTATED !== "false" || config.SITE_NOINDEX !== "true")
    fail("Cannot enable outside payments or indexing.");
  return config;
}
function safeEnv(config) {
  const env = { ...process.env, ...config };
  // Do not inherit production credentials from the developer's shell.
  for (const key of Object.keys(env))
    if (key === "DATABASE_URL" || key === "REDIS_URL" ||
        key === "YOOKASSA_SECRET_KEY" ||
        key.startsWith("RAILWAY_") ||
        (key.startsWith("OPENAI_") && key !== "OPENAI_API_KEY"))
      delete env[key];
  env.OPENAI_API_KEY = "";
  env.CAREER_AI_ENABLED = "0";
  env.CAREER_AI_MODE = "rules";
  env.NEXT_PUBLIC_SITE_URL = config.CAREER_APP_ORIGIN;
  env.NEXT_PUBLIC_YANDEX_METRICA_ID = "";
  env.SITE_NOINDEX = "true";
  return env;
}
function composeArgs(cmd) {
  return [
    "compose", "-p", "mironovich_career_synthetic",
    "--env-file", envPath, "-f", composePath, ...cmd,
  ];
}
function run(binary, args, env = process.env, silent = false) {
  const result = spawnSync(binary, args, {
    cwd: root, env, shell: false, stdio: silent ? "pipe" : "inherit",
    timeout: 180000,
  });
  if (result.error) fail("Failed to execute " + binary + ": " + result.error.message);
  if (result.status !== 0) fail("Failed to execute " + binary + " (exit " + result.status + ")");
}
function destroyDb(config) {
  run("docker", composeArgs(["down", "--volumes", "--remove-orphans"]), safeEnv(config));
}
async function waitFor(url, options, deadlineMs, processCheck) {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    if (processCheck?.()) fail("A synthetic local service stopped unexpectedly.");
    try {
      const r = await fetch(url, { ...options, signal: AbortSignal.timeout(1200) });
      if (r.ok) return r;
    } catch { /* not ready yet */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  fail("Local-only synthetic service did not start.");
}
async function start(config) {
  if (!existsSync(path.join(root, "node_modules", "next")))
    fail("Run npm ci once before launching the local sandbox.");
  if (!existsSync(composePath)) fail("Local Docker Compose file is missing.");
  const env = safeEnv(config);
  run("docker", ["--version"], env, true);
  let fixture, server, closing = false;
  function cleanup() {
    if (closing) return;
    closing = true;
    fixture?.kill();
    server?.kill();
    try { destroyDb(config); }
    catch { console.error("[career-local] Docker cleanup failed. Run npm run career:local:destroy."); }
  }
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });
  try {
    run("docker", composeArgs(["up", "-d", "--wait"]), env);
    run(process.execPath, ["--experimental-strip-types", "scripts/career/runtime.mjs", "migrate"], env);
    fixture = spawn(process.execPath, ["scripts/career/fixtures.mjs"], {
      cwd: root, env, stdio: "inherit",
    });
    await waitFor(
      "http://127.0.0.1:3305/fixture/mail/demo-health@example.invalid",
      { headers: { "x-fixture-key": config.CAREER_FIXTURE_CONTROL_SECRET } },
      15000, () => fixture.exitCode !== null || fixture.signalCode !== null,
    );
    run(process.execPath, ["--experimental-strip-types", "scripts/career/runtime.mjs", "build"], env);
    server = spawn(process.execPath,
      ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3300"], {
        cwd: root, env, stdio: "inherit",
      });
    await waitFor("http://127.0.0.1:3300/career/sandbox", {}, 30000,
      () => server.exitCode !== null || server.signalCode !== null);
    console.log("\n[career-local] Open http://127.0.0.1:3300/career/sandbox");
    console.log("[career-local] Run 'npm run career:local:gate' in another terminal for the tester code.");
    console.log("[career-local] Use ONLY demo-...@example.invalid. Read OTP with career:local:otp.");
    console.log("[career-local] Press Ctrl+C to stop and erase the in-memory database.\n");
    await new Promise((resolve) => {
      server.once("exit", resolve);
      fixture.once("exit", resolve);
    });
  } finally {
    cleanup();
  }
}
async function main() {
  if (command === "help") {
    console.log("Commands: init | verify | start | gate | otp <demo-email> | destroy");
    return;
  }
  if (command === "init") { init(); readConfig(); return; }
  const config = readConfig();
  if (command === "verify") {
    console.log("[career-local] Safe localhost-only settings verified; AI and real payments disabled.");
  } else if (command === "gate") {
    console.log("Local tester passphrase (never share): " + config.CAREER_TESTER_SECRET);
  } else if (command === "otp") {
    const address = process.argv[3] || "";
    if (!/^demo-[a-z0-9-]{1,48}@example\.invalid$/.test(address))
      fail("Only demo-...@example.invalid is accepted.");
    const response = await waitFor(
      "http://127.0.0.1:3305/fixture/mail/" + encodeURIComponent(address),
      { headers: { "x-fixture-key": config.CAREER_FIXTURE_CONTROL_SECRET } },
      2500,
    );
    const result = await response.json();
    if (!result.code) fail("No synthetic OTP in memory for this address.");
    console.log("Local-only OTP: " + result.code);
  } else if (command === "destroy") {
    destroyDb(config);
    console.log("[career-local] Synthetic PostgreSQL stopped and ephemeral data discarded.");
  } else if (command === "start") {
    await start(config);
  } else fail("Unknown command: " + command);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
