"""Synthetic tools-v3 checks against a local production build, with Telegram stub.
Python Playwright + Chromium; optional AXE_SCRIPT points to axe-core/axe.min.js.
Never run against production: the two real /api/lead checks require the local stub.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json, math, os, re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/tools/cost-why-v3"
OUT.mkdir(parents=True, exist_ok=True)
URL = os.environ.get("TOOLS_V3_BASE_URL", "http://localhost:3004")
assert URL.startswith(("http://localhost:", "http://127.0.0.1:")), "Local stubbed server only"
STUB = Path(os.environ.get("TOOLS_V3_STUB_REPORT", "/tmp/tools-v3-delivery.json"))
assert STUB.exists(), "Start the explicit synthetic Telegram stub before testing"
report = {"viewports": [], "flows": [], "accessibility": [], "javascriptErrors": [], "expectedHttpErrors": 0, "externalBrowserCalls": 0, "aiRequests": 0, "serverStubChecks": []}
LABEL = "Отчёты и таблицы"

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])

    def page(w):
        c = browser.new_context(viewport={"width": w, "height": 812 if w < 560 else 1000}, reduced_motion="reduce")
        p = c.new_page(); posts = []; console = []
        p.on("pageerror", lambda e: report["javascriptErrors"].append(str(e)))
        p.on("console", lambda m: console.append(m.text) if m.type == "error" else None)
        def request(r):
            if "/api/" in r.url and r.method == "POST": posts.append(r.post_data_json)
            if "/api/tools/" in r.url: report["aiRequests"] += 1
            if "api.openai.com" in r.url or "api.telegram.org" in r.url: report["externalBrowserCalls"] += 1
        p.on("request", request)
        return c, p, posts, console

    def fit(p): assert p.evaluate("document.documentElement.scrollWidth===innerWidth"), p.url
    def metric(root, key, number):
        text = root.locator(f'[data-metric="{key}"]').first.inner_text()
        assert re.sub(r"\D", "", text) == str(number), (key, text, number)
    def capture(p, root, name):
        old = p.viewport_size; box = root.bounding_box()
        p.set_viewport_size({"width": old["width"], "height": max(old["height"], math.ceil(box["height"]) + 180)})
        root.scroll_into_view_if_needed(); p.wait_for_timeout(100); root.screenshot(path=str(OUT / name)); p.set_viewport_size(old)
    def axe(p, phase):
        if not os.environ.get("AXE_SCRIPT"): return
        p.add_script_tag(path=os.environ["AXE_SCRIPT"])
        issues = p.evaluate("async()=> (await axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))")
        report["accessibility"].append({"width": p.viewport_size["width"], "phase": phase, "violations": issues})
        assert not issues, issues
    def visit(p, path):
        response = p.goto(URL + path, wait_until="networkidle"); assert response.status == 200
        assert p.locator('link[rel="canonical"]').get_attribute("href").endswith(path)
        assert p.locator("main h1").count() == 1
        assert p.get_by_role("button", name="Разобрать мою ситуацию с ИИ", exact=True).count() == 0
        assert p.get_by_text("Приоритеты с OpenAI", exact=True).count() == 0
        fit(p)
    def choose(p, task): p.locator(f'input[name="tasks"][value="{task}"]').check()
    def preset(p, field, value): p.locator("#" + field).locator("..").locator(f'button[aria-label$=": {value}"]').click()
    def sample(p, task="reporting", rate=True):
        p.locator("#cost-team").fill("3"); p.locator(f"#cost-{task}-employees").fill("3")
        preset(p, f"cost-{task}-repetitions", 20); preset(p, f"cost-{task}-minutes", 3); preset(p, f"cost-{task}-periods", 22)
        if rate: p.locator(f"#cost-{task}-hourly").fill("600")
    def show(p):
        p.get_by_role("button", name="Показать стоимость и причины", exact=True).click()
        r = p.get_by_role("region", name="Стоимость и причины проверки"); r.wait_for(); fit(p)
        expect(p.locator("#cost-result-heading")).to_be_focused()
        assert "Готовый сервис" not in r.inner_text(); return r
    def edit(p):
        p.get_by_role("button", name="Изменить исходные данные", exact=True).click()
        expect(p.get_by_role("heading", name="Какая работа повторяется?", exact=True)).to_be_focused()
    def actual_lead(p, posts, unknown=False):
        before = len(posts)
        p.get_by_role("button", name="Разобрать эти затраты с экспертом", exact=True).click()
        expect(p.locator("#lead-name")).to_be_focused()
        assert p.get_by_role("region", name="Стоимость и причины проверки").is_visible()
        axe(p, "consultation")
        if not unknown: capture(p, p.get_by_role("region", name="Консультация по затратам"), "consultation-375.png")
        p.locator("#lead-name").fill("Тест"); p.locator("#lead-phone").fill("@synthetic_test_user")
        p.locator("#lead-task").fill("Синтетическая проверка <контекста> & расчёта")
        p.get_by_role("button", name="Отправить задачу", exact=True).click(); assert len(posts) == before
        p.locator("#lead-consent").check()
        def tamper(route, request):
            body = request.post_data_json
            body["toolContext"]["result"] = {"cost": 999999, "cashSavings": 999999}
            route.continue_(post_data=json.dumps(body, ensure_ascii=False))
        p.route("**/api/lead", tamper)
        p.get_by_role("button", name="Отправить задачу", exact=True).click()
        p.get_by_text("Заявка отправлена.", exact=True).wait_for()
        assert len(posts) == before + 1
        body = posts[-1]; assert body["consent"] is True and body["toolContext"]["version"] == "tools-cost-3.0.0"
        meta = json.loads(STUB.read_text()); assert meta["costVersion"] and meta["serverRecalculated"] and meta["noForgedTotals"] and meta["escaped"]
        if unknown:
            assert meta["unknownCost"] and not meta["has39600"]
            assert body["toolContext"]["input"]["processes"]["reporting"]["cost"] == {"kind": "unknown"}
        else: assert meta["has39600"] and meta["has475200"] and meta["monthlyBasis"]
        report["serverStubChecks"].append({"scenario": "unknown-scenario-excluded" if unknown else "monthly-rate-recalculated", "passed": True})

    for w in [320, 375, 768, 1024, 1440]:
        # Owner with measurements and a known rate; both URLs and two rate sources.
        c, p, posts, console = page(w); visit(p, "/tools/labor-cost")
        assert p.locator("#cost-team").input_value() == "4"
        p.get_by_role("button", name="Показать стоимость и причины", exact=True).click(); assert p.get_by_role("alert").count() > 0
        choice = p.locator('input[name="tasks"][value="reporting"]'); choice.focus(); p.keyboard.press("Space")
        for n in [4, 10, 25, 50]: preset(p, "cost-team", n); assert p.locator("#cost-reporting-employees").input_value() == str(n)
        assert p.locator("#cost-reporting-hourly").input_value() == ""
        assert p.locator("#cost-reporting-minutes").evaluate("e=>!e.closest('details')")
        sample(p); preview = p.locator('[aria-label="Предпросмотр: Отчёты и таблицы"]')
        metric(preview, "monthly", 39600); metric(preview, "hours", 66); metric(preview, "annual", 475200)
        axe(p, "input"); fit(p)
        if w in [375, 1440]: capture(p, p.locator("main form").first, f"input-{w}.png")
        r = show(p); row = r.get_by_role("article", name=LABEL, exact=True)
        metric(row, "monthly", 39600); metric(row, "hours", 66); metric(row, "annual", 475200)
        assert row.locator('[data-metric="monthly"]').evaluate("e=>!e.closest('details')")
        assert "30 ₽ за одно выполнение" in row.inner_text(); assert "не сумма устранимых потерь" in row.inner_text()
        assert r.get_by_role("button", name="Разобрать эти затраты с экспертом", exact=True).count() == 1
        assert not posts; axe(p, "known-result"); capture(p, r, f"known-{w}.png")
        p.get_by_role("link", name="Проверить причины затрат во втором инструменте", exact=False).click(); p.wait_for_url("**/tools/automation-cost")
        r = p.get_by_role("region", name="Стоимость и причины проверки"); metric(r, "monthly", 39600)
        edit(p); assert p.locator("#cost-reporting-hourly").input_value() == "600"
        p.locator("#cost-team").fill("10"); assert p.locator("#cost-reporting-employees").input_value() == "3"
        p.locator("#cost-team").fill("3")
        p.get_by_role("button", name="Полная стоимость за месяц", exact=True).click()
        assert p.locator("#cost-reporting-monthly").input_value() == "" and p.locator("#cost-reporting-paidHours").input_value() == "160"
        assert "Допущение 160 ч/мес" in p.locator("main").inner_text()
        p.locator("#cost-reporting-monthly").fill("96000"); r = show(p); metric(r, "monthly", 39600)
        if w == 375: actual_lead(p, posts)
        fit(p); assert not console, console; c.close()

        # Owner without measurements; then measured time with an unknown company rate.
        c, p, posts, console = page(w); visit(p, "/tools/automation-cost"); choose(p, "reporting")
        r = show(p); assert "Не замерена" in r.inner_text() and "Неизвестна" in r.inner_text(); assert not posts
        edit(p); sample(p, rate=False); p.get_by_role("button", name="Не знаю ставку", exact=True).click()
        r = show(p); metric(r, "hours", 66); assert r.locator('[data-metric="monthly"]').first.inner_text() == "Неизвестна"
        p.locator("#scenario-reporting").fill("1e9"); assert r.get_by_role("alert").count() == 1
        p.get_by_role("button", name="600 ₽/ч — пример", exact=True).click(); assert "Условно при" in r.inner_text() and "39\xa0600" in r.inner_text()
        assert r.locator('[data-metric="monthly"]').first.inner_text() == "Неизвестна"
        assert not posts; assert p.evaluate("!JSON.stringify({...sessionStorage}).includes('scenarioRate')")
        if w in [375, 1440]: capture(p, r, f"unknown-{w}.png")
        if w == 375: axe(p, "unknown-result")
        if w == 1440: actual_lead(p, posts, unknown=True)
        assert not console, console; c.close()

        # Multiple processes: partial, overlapping, then explicitly independent.
        c, p, posts, console = page(w); visit(p, "/tools/labor-cost"); choose(p, "reporting"); choose(p, "transfer"); sample(p)
        r = show(p); summary = r.locator('[aria-label="Общий итог"]')
        assert "есть незавершённые замеры" in summary.inner_text() and summary.locator("[data-metric]").count() == 0
        edit(p); p.locator("#cost-transfer-employees").fill("1"); p.locator("#cost-transfer-frequency").select_option("month")
        p.locator("#cost-transfer-repetitions").fill("20"); p.locator("#cost-transfer-minutes").fill("3"); p.locator("#cost-transfer-hourly").fill("600")
        r = show(p); summary = r.locator('[aria-label="Общий итог"]')
        assert "не подтверждено отсутствие пересечений" in summary.inner_text() and summary.locator("[data-metric]").count() == 0
        if w in [375, 1440]: capture(p, r, f"overlap-{w}.png")
        if w == 375: axe(p, "overlap-result")
        edit(p)
        for box in p.get_by_label("Эта работа не включена в другие выбранные процессы. Подтверждаю отсутствие пересечений.", exact=True).all(): box.check()
        r = show(p); summary = r.locator('[aria-label="Общий итог"]')
        metric(summary, "hours", 67); metric(summary, "monthly", 40200); metric(summary, "annual", 482400)
        assert not posts; fit(p); assert not console, console; c.close()
        report["viewports"].append({"width": w, "bothURLs": True, "noOverflow": True, "canonical": True, "presetsAndManual": True, "livePreview": True, "knownRate": True, "monthlyBasis": True, "unknownRate": True, "conditionalNotActual": True, "partialNotSummed": True, "overlapNotSummed": True, "independentSum": True, "keyboardFocus": True})
        print("WIDTH", w, "PASS", flush=True)

    # Number validation/focus and controlled delivery errors preserve calculations.
    c, p, posts, console = page(375); visit(p, "/tools/labor-cost"); choose(p, "reporting"); sample(p)
    p.locator("#cost-reporting-employees").fill("5"); p.get_by_role("button", name="Показать стоимость и причины", exact=True).click()
    expect(p.locator("#cost-reporting-employees")).to_be_focused(); assert "Участников не может быть больше команды" in p.locator("main").inner_text()
    p.locator("#cost-reporting-employees").fill("3"); r = show(p); p.get_by_role("button", name="Разобрать эти затраты с экспертом", exact=True).click()
    p.locator("#lead-name").fill("Тест"); p.locator("#lead-phone").fill("@synthetic_test_user"); p.locator("#lead-consent").check()
    statuses = iter([429, 502])
    p.route("**/api/lead", lambda route, request: route.fulfill(status=next(statuses), json={"ok": False, "delivered": False}))
    for status, message in [(429, "Слишком много попыток."), (502, "Не получилось доставить заявку.")]:
        p.get_by_role("button", name="Отправить задачу", exact=True).click(); p.get_by_text(message, exact=False).wait_for(); assert p.locator("#lead-name").input_value() == "Тест"; metric(r, "monthly", 39600)
    assert len(console) == 2 and "429" in console[0] and "502" in console[1], console
    report["expectedHttpErrors"] = 2; c.close()
    report["flows"] = ["Владелец без данных и условная ставка", "Владелец со ставкой часа / полной месячной стоимостью", "Несколько процессов: частично измеренные, пересекающиеся и независимые"]
    assert not report["javascriptErrors"] and not report["aiRequests"] and not report["externalBrowserCalls"], report
    (OUT / "browser-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2)); browser.close()
