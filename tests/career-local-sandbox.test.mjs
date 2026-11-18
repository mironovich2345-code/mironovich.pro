import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const script = readFileSync("scripts/career/local-sandbox.mjs","utf8");
const compose = readFileSync("docker-compose.career-local.yml","utf8");

test("local sandbox launcher parses and offers safe commands without touching data", () => {
  const syntax = spawnSync(process.execPath, ["--check", "scripts/career/local-sandbox.mjs"], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);
  const help = spawnSync(process.execPath, ["scripts/career/local-sandbox.mjs", "help"], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /init \| verify \| start \| gate \| otp/);
});

test("only synthetic payment/SMTP/AI are possible in the local launcher", () => {
  for (const item of [
    'CAREER_SANDBOX_ENABLED: "1"',
    'CAREER_ONLY_SYNTHETIC: "true"',
    'CAREER_APP_ORIGIN: "http://127.0.0.1:3300"',
    'CAREER_PAYMENT_MODE: "fixture"',
    'CAREER_PROVIDER_FIXTURE_URL: "http://127.0.0.1:3305"',
    'CAREER_AI_MODE: "rules"',
    'CAREER_AI_ENABLED: "0"',
    'OPENAI_API_KEY: ""',
  ]) assert.ok(script.includes(item), "Required guard: " + item);
  assert.match(script, /if \(config\.YOOKASSA_TEST_KEY_ROTATED !== "false"/);
  assert.match(script, /env\.OPENAI_API_KEY = ""/);
  assert.match(script, /env\.NEXT_PUBLIC_YANDEX_METRICA_ID = ""/);
  assert.match(script, /readConfig\(\)/);
  assert.match(script, /Run npm run career:local:init first/);
});

test("database container is isolated to localhost and all storage is ephemeral", () => {
  assert.match(compose, /127\.0\.0\.1:55433:5432/);
  assert.match(compose, /tmpfs:/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /postgres:16-alpine/);
  assert.match(script, /"down", "--volumes", "--remove-orphans"/);
  assert.match(script, /"mironovich_career_test"/);
  assert.match(script, /CAREER_DB_PASSWORD/);
});

test("the developer guide never encourages real customer info or deploy", () => {
  const guide = readFileSync("docs/commerce/career-local-sandbox-setup.md","utf8");
  assert.match(guide, /Docker Desktop/);
  assert.match(guide, /npm run career:local:start/);
  assert.match(guide, /npm run career:local:otp/);
  assert.match(guide, /demo-qa@example\.invalid/);
  assert.match(guide, /\*\*не\*\* принимает[\s\S]*настоящие платежи/);
});
