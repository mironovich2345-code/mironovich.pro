// AI Career 3.0 stage 1 — SMTP module at code level, against a loopback TLS SMTP server (no real mailbox, no network).
// Checks: implicit TLS, AUTH with the configured user, sender info@mironovich.pro, recipient, subject and the code in the
// body; a rejected password gives a sanitized error (no secret, no full address in the log).
//   node --experimental-strip-types tests/career-stage1-smtp.mjs
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import tls from "node:tls";

if (process.env.SMTP_CHILD === "1") {
  // Child: the real module, configured exactly like production except the loopback host/port.
  const cfg = await import("../lib/server/career-demo/config.ts");
  const mail = await import("../lib/server/career-demo/mail.ts");
  const c = cfg.demoConfig(process.env);
  assert.ok(c, "configuration must be valid: " + cfg.demoProblems(process.env).join("; "));
  assert.equal(c.mail.mode, "smtp");
  const r = await mail.sendCodeEmail(c, "learner@example.com", "482913", 10);
  process.stdout.write(JSON.stringify(r));
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "stage1-smtp-"));
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1",
  "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem")], { stdio: "ignore" });
const received = [];
const server = tls.createServer({ key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) }, (sock) => {
  const msg = { auth: null, from: null, to: [], data: "" };
  let inData = false, buf = "";
  const say = (l) => sock.write(l + "\r\n");
  say("220 loopback ESMTP test");
  sock.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    let i;
    while ((i = buf.indexOf("\r\n")) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (inData) {
        if (line === ".") { inData = false; received.push(msg); say("250 OK queued"); } else msg.data += line.replace(/^\.\./, ".") + "\n";
        continue;
      }
      const cmd = line.split(" ")[0].toUpperCase();
      if (cmd === "EHLO" || cmd === "HELO") { sock.write("250-loopback\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n"); }
      else if (cmd === "AUTH") {
        const [, mech, arg] = line.split(" ");
        if (mech.toUpperCase() !== "PLAIN" || !arg) { say("504 PLAIN only"); continue; }
        const [, user, pass] = Buffer.from(arg, "base64").toString().split("\u0000");
        msg.auth = { user, passOk: pass === "app-password-OK" };
        say(msg.auth.passOk ? "235 Authentication successful" : "535 Authentication failed");
      }
      else if (cmd === "MAIL") { msg.from = /<([^>]*)>/.exec(line)?.[1]; say("250 OK"); }
      else if (cmd === "RCPT") { msg.to.push(/<([^>]*)>/.exec(line)?.[1]); say("250 OK"); }
      else if (cmd === "DATA") { inData = true; say("354 End data with <CR><LF>.<CR><LF>"); }
      else if (cmd === "QUIT") { say("221 Bye"); sock.end(); }
      else if (cmd === "RSET" || cmd === "NOOP") say("250 OK");
      else say("502 Not implemented");
    }
  });
  sock.on("error", () => {});
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const run = (password) => {
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME, SMTP_CHILD: "1", NODE_EXTRA_CA_CERTS: join(dir, "cert.pem"),
    CAREER_V3_DEMO: "1", CAREER_V3_DEMO_LOCAL: "1", CAREER_V3_DEMO_PROFILE: "stage1", SITE_NOINDEX: "1", CAREER_V3_DEMO_ORIGIN: "http://127.0.0.1:3499",
    CAREER_V3_DEMO_DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/mironovich_career_stage1", CAREER_V3_DEMO_SESSION_SECRET: "s".repeat(16) + "0123456789abcdef0123456789abcdef0123",
    CAREER_V3_OTP_SECRET: "o".repeat(8) + "fedcba9876543210fedcba9876543210",
    CAREER_V3_MAIL: "smtp", CAREER_V3_SMTP_HOST: "127.0.0.1", CAREER_V3_SMTP_PORT: String(port), CAREER_V3_SMTP_USER: "info@mironovich.pro",
    CAREER_V3_SMTP_PASSWORD: password, CAREER_V3_SMTP_FROM: "AI Career <info@mironovich.pro>",
  };
  // Asynchronous child: the loopback server lives in this process and must keep answering meanwhile.
  return new Promise((resolve, reject) => {
    const ch = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", new URL(import.meta.url).pathname], { env });
    let out = "", err = "";
    ch.stdout.on("data", (d) => (out += d)); ch.stderr.on("data", (d) => (err += d));
    const t = setTimeout(() => { ch.kill(); reject(new Error("child timeout")); }, 30000);
    ch.on("close", (code) => { clearTimeout(t); if (code !== 0) reject(new Error(err)); else resolve({ result: JSON.parse(out), log: err }); });
  });
};

const ok = await run("app-password-OK");
assert.deepEqual(ok.result, { ok: true });
assert.equal(received.length, 1);
const m = received[0];
assert.deepEqual(m.auth, { user: "info@mironovich.pro", passOk: true }, "AUTH with the configured mailbox");
assert.equal(m.from, "info@mironovich.pro", "envelope sender");
assert.deepEqual(m.to, ["learner@example.com"]);
assert.match(m.data, /^From: AI Career <info@mironovich\.pro>$/m);
assert.match(m.data, /^Subject: =\?UTF-8\?/m, "Russian subject is MIME-encoded");
assert.match(m.data, /482913/, "code in the body");
console.log("PASS SMTP over TLS: AUTH as info@mironovich.pro, sender, recipient, subject and code delivered");

const bad = await run("wrong-password");
assert.equal(bad.result.ok, false);
assert.ok(bad.result.errorCode, "sanitized error code");
assert.equal(received.length, 1, "nothing delivered with a rejected password");
assert.doesNotMatch(bad.log, /wrong-password|app-password|learner@example\.com|482913/, "log has no secret, full address or code");
assert.match(bad.log, /"recipientDomain":"example\.com"/);
console.log("PASS rejected password: no delivery, sanitized error, no secrets or code in the log");

server.close();
rmSync(dir, { recursive: true, force: true });
console.log("career stage-1 smtp: 2 passed");
