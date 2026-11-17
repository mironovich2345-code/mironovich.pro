// Explicitly local synthetic end-to-end QA. Never points at a published site.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
process.loadEnvFile(".env.career.local");
const origin = process.env.CAREER_APP_ORIGIN;
assert.equal(new URL(origin).hostname, "127.0.0.1");
assert.equal(process.env.CAREER_PAYMENT_MODE, "fixture");
const out = "/tmp/mironovich-career-browser";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
});
const errors = [],
  external = [],
  checks = [];
const pass = (name) => {
  checks.push(name);
  console.log("PASS", name);
};
async function visitor() {
  const context = await browser.newContext({
    baseURL: origin,
    acceptDownloads: true,
  });
  await context.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== origin) {
      external.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return {
    context,
    page,
    email: `demo-${randomUUID().slice(0, 12)}@example.invalid`,
  };
}
async function login(v) {
  await v.page.goto("/career/sandbox");
  await v.page
    .getByLabel("Код доступа тестировщика")
    .fill(process.env.CAREER_TESTER_SECRET);
  await v.page.getByLabel("Работаю только с синтетическими данными").check();
  await v.page.getByRole("button", { name: "Открыть тестовый контур" }).click();
  await v.page.getByLabel("Учебный email", { exact: true }).fill(v.email);
  await v.page
    .getByRole("button", { name: "Получить код", exact: true })
    .click();
  await v.page.getByLabel("Одноразовый код", { exact: true }).waitFor();
  const response = await fetch(
    new URL(
      "/fixture/mail/" + encodeURIComponent(v.email),
      process.env.CAREER_PROVIDER_FIXTURE_URL,
    ),
    { headers: { "x-fixture-key": process.env.CAREER_FIXTURE_CONTROL_SECRET } },
  );
  const { code } = await response.json();
  assert.match(code, /^\d{6}$/);
  await v.page.getByLabel("Одноразовый код", { exact: true }).fill(code);
  await v.page
    .getByRole("button", { name: "Войти по коду", exact: true })
    .click();
  await v.page.getByRole("heading", { name: "Аккаунт", exact: true }).waitFor();
  assert.equal(
    await v.page.locator('input[autocomplete="one-time-code"]').count(),
    0,
  );
}
async function post(v, path, body, headers = {}) {
  return v.context.request.post("/api/career/" + path, {
    data: body,
    headers: { Origin: origin, ...headers },
  });
}
async function layout(v, state) {
  for (const width of [375, 390, 768, 1024, 1440]) {
    await v.page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await v.page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 2,
      ),
      false,
      state + " " + width,
    );
    if ([375, 1440].includes(width))
      await v.page.screenshot({
        path: `${out}/${state}-${width}.png`,
        fullPage: true,
      });
  }
  pass(state + ": five mobile/desktop widths without overflow");
}
try {
  const a = await visitor(),
    b = await visitor();
  assert.equal(
    (await a.context.request.get("/api/career/session")).status(),
    403,
  );
  await a.page.goto("/career/sandbox");
  assert.match(
    await a.page.locator('meta[name="robots"]').getAttribute("content"),
    /noindex/,
  );
  await layout(a, "tester-gate");
  await login(a);
  await login(b);
  pass("Two independent browser contexts, tester admission and SMTP OTP login");
  const cookies = await a.context.cookies();
  for (const name of ["career_test_session", "career_test_gate"]) {
    const c = cookies.find((c) => c.name === name);
    assert(c.httpOnly);
    assert.equal(c.sameSite, "Lax");
  }
  assert.equal(
    (
      await post(a, "orders", {
        kind: "initial",
        adult: true,
        offer: true,
        amount: 1,
      })
    ).status(),
    400,
  );
  assert.equal(
    (
      await post(a, "orders", { kind: "initial", adult: false, offer: true })
    ).status(),
    400,
  );
  assert.equal(
    (
      await post(
        a,
        "orders",
        { kind: "initial", adult: true, offer: true },
        { Origin: "https://evil.example" },
      )
    ).status(),
    403,
  );
  assert.equal(
    (
      await a.context.request.post("/api/career/analysis", {
        data: "x".repeat(17000),
        headers: { Origin: origin, "Content-Type": "application/json" },
      })
    ).status(),
    413,
  );
  pass(
    "Server rejects forged price, missing age, cross-site POST and oversized input",
  );
  await layout(a, "account-empty");
  await a.page.getByLabel("Мне исполнилось 18 лет", { exact: true }).check();
  await a.page.getByLabel(/Я ознакомился/).check();
  await a.page
    .getByRole("button", { name: "Создать тестовый заказ", exact: true })
    .click();
  await a.page.getByText("Ожидает тестовой оплаты", { exact: true }).waitFor();
  const orderId = await a.page
    .locator("[data-order]")
    .first()
    .getAttribute("data-order");
  assert.equal((await post(b, "orders/refresh", { orderId })).status(), 404);
  assert.equal(
    (await b.context.request.get("/api/career/report")).status(),
    403,
  );
  assert.equal(
    (await a.context.request.get("/api/career/session")).headers()[
      "cache-control"
    ],
    "no-store",
  );
  assert.equal(
    await a.page
      .getByRole("heading", { name: "18 основных вопросов", exact: true })
      .count(),
    0,
  );
  pass("Pending payment grants no access; foreign order and PDF denied");
  await a.page.goto("/payment/result?status=succeeded");
  await a.page.getByRole("heading", { name: "Аккаунт", exact: true }).waitFor();
  assert.equal(
    await a.page
      .getByRole("heading", { name: "18 основных вопросов", exact: true })
      .count(),
    0,
  );
  await a.page
    .getByRole("button", { name: "Завершить локальную симуляцию", exact: true })
    .click();
  await a.page
    .getByRole("heading", { name: "18 основных вопросов", exact: true })
    .waitFor();
  assert.equal(await a.page.locator("select[name]").count(), 18);
  await a.page
    .getByRole("button", { name: "Заполнить учебным примером", exact: true })
    .click();
  await a.page
    .getByRole("button", { name: "Сохранить 18 ответов", exact: true })
    .click();
  await a.page
    .getByRole("status")
    .filter({ hasText: "18 учебных ответов сохранены" })
    .waitFor();
  await layout(a, "diagnostic");
  await a.page
    .getByRole("button", {
      name: "Сформировать один учебный анализ",
      exact: true,
    })
    .click();
  await a.page
    .getByRole("heading", {
      name: "Персональный учебный результат",
      exact: true,
    })
    .waitFor();
  assert.equal(await a.page.locator("section ol li").count(), 30);
  await layout(a, "report-plan");
  const downloadPromise = a.page.waitForEvent("download");
  await a.page
    .getByRole("link", { name: "Скачать учебный PDF", exact: true })
    .click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "career-synthetic-report.pdf");
  const pdf = await a.context.request.get("/api/career/report");
  assert.equal(pdf.status(), 200);
  assert.match((await pdf.body()).subarray(0, 8).toString(), /^%PDF-/);
  assert.equal(pdf.headers()["cache-control"], "private, no-store");
  await a.page.getByLabel(/^День 1\./).check();
  await a.page
    .getByRole("button", { name: "Обновить кабинет", exact: true })
    .click();
  assert(await a.page.getByLabel(/^День 1\./).isChecked());
  const first = await (
    await a.context.request.get("/api/career/session")
  ).json();
  const repeated = await (await post(a, "analysis", {})).json();
  assert.equal(repeated.reused, true);
  assert.deepEqual(repeated.result, first.result);
  const second = await (
    await b.context.request.get("/api/career/session")
  ).json();
  assert.equal(second.result, null);
  assert.equal(second.orders.length, 0);
  assert.equal(second.active, false);
  pass(
    "18-question diagnostic, single report, real PDF download, 30-day progress and visitor isolation",
  );
  await a.page
    .getByRole("button", {
      name: "Проверить полный тестовый возврат",
      exact: true,
    })
    .click();
  await a.page.getByText("Тестовый возврат", { exact: true }).waitFor();
  assert.equal(
    await a.page
      .getByRole("button", { name: "Создать тестовый заказ", exact: true })
      .count(),
    0,
  );
  assert.equal(
    (await a.context.request.get("/api/career/report")).status(),
    403,
  );
  await a.page.getByRole("button", { name: "Выйти", exact: true }).click();
  await a.page
    .getByRole("heading", { name: "Допуск тестировщика", exact: true })
    .waitFor();
  assert.equal(
    (await a.context.request.get("/api/career/session")).status(),
    403,
  );
  pass(
    "Full test refund revokes PDF access; logout deletes admission and session",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  pass("No browser errors, analytics calls or external requests");
  console.log(`${checks.length} browser scenario groups passed`);
  await a.context.close();
  await b.context.close();
} finally {
  writeFileSync(
    out + "/results.json",
    JSON.stringify({ checks, errors, external }, null, 2),
  );
  await browser.close();
}
