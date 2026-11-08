"""Synthetic-only UI checks. Requires Python Playwright + Chromium, no API credentials.
Run two local production servers: normal on 3001; explicit loopback mock on 3002.
Optional AXE_SCRIPT points to a locally installed axe-core/axe.min.js.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json, math, os

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get("ANALYSIS_SCREENSHOTS_DIR", ROOT / "docs/tools/screenshots/process-analysis"))
OUT.mkdir(parents=True, exist_ok=True)
OFF = os.environ.get("ANALYSIS_OFF_URL", "http://localhost:3001")
DEMO = os.environ.get("ANALYSIS_DEMO_URL", "http://localhost:3002")
assert all(url.startswith(("http://localhost:", "http://127.0.0.1:")) for url in [OFF, DEMO]), "Local synthetic test servers only"
TEXT = "Менеджер переносит обращения из общей таблицы в карточки задач. Нужно проверять дубли и показывать спорные записи ответственному."
report = {"widths": [], "errors": [], "expectedMockHttpErrors": 0, "realExternalCalls": 0, "accessibility": []}

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])

    def page(width):
        context = browser.new_context(viewport={"width": width, "height": 812 if width < 560 else 1000}, reduced_motion="reduce")
        p = context.new_page(); posts = []; console = []
        p.on("pageerror", lambda error: report["errors"].append(str(error)))
        p.on("console", lambda msg: console.append(msg.text) if msg.type == "error" else None)
        def request(r):
            if r.method == "POST" and "/api/" in r.url: posts.append({"url": r.url, "body": r.post_data_json})
            if "api.openai.com" in r.url or "api.telegram.org" in r.url: raise AssertionError("Unexpected external delivery")
        p.on("request", request)
        return context, p, posts, console

    def fit(p):
        assert p.evaluate("document.documentElement.scrollWidth===innerWidth"), p.url

    def capture(p, target, name):
        old = p.viewport_size; box = target.bounding_box()
        p.set_viewport_size({"width": old["width"], "height": max(old["height"], math.ceil(box["height"]) + 160)})
        target.scroll_into_view_if_needed(); p.wait_for_timeout(100)
        target.screenshot(path=str(OUT / name)); p.set_viewport_size(old)

    def base(p, url, multiple=True):
        p.goto(url + "/tools/automation-cost", wait_until="networkidle")
        p.locator('input[name="tasks"][value="crm"]').check()
        if multiple: p.locator('input[name="tasks"][value="reporting"]').check()
        p.get_by_role("button", name="Узнать, что можно автоматизировать", exact=True).click()
        p.get_by_role("heading", name="С чего начать", exact=True).wait_for(); fit(p)

    def axe(p, phase):
        source = os.environ.get("AXE_SCRIPT")
        if not source: return
        p.add_script_tag(path=source)
        issues = p.evaluate("async()=> (await axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))")
        report["accessibility"].append({"phase": phase, "width": p.viewport_size["width"], "violations": issues})
        assert not issues, issues

    for width in [320, 375, 768, 1024, 1440]:
        c, p, posts, console = page(width)
        base(p, OFF)
        assert p.get_by_role("button", name="Разобрать мою ситуацию с ИИ", exact=True).count() == 0
        assert p.get_by_text("Приоритеты с OpenAI", exact=True).count() == 0
        assert not posts
        if width in [375, 1440]: capture(p, p.get_by_role("region", name="Результат разбора процессов"), f"baseline-off-{width}.png")
        # Existing numeric example and transfer remain independent of all AI services.
        p.goto(OFF + "/tools/labor-cost", wait_until="networkidle")
        p.locator('input[name="tasks"][value="reporting"]').check()
        p.get_by_text("Уточнить расчёт времени — необязательно", exact=True).click()
        p.locator("#guided-employees").fill("3"); p.locator("#reporting-employees").fill("3")
        p.locator("#reporting-frequency").select_option("day")
        for key, value in [("repetitions", "20"), ("minutes", "3"), ("periodsPerMonth", "22"), ("hourlyCost", "600")]: p.locator("#reporting-" + key).fill(value)
        p.get_by_label("Подтверждаю: эти операции не учтены в других выбранных процессах", exact=True).check()
        p.get_by_role("button", name="Узнать, что можно автоматизировать", exact=True).click()
        p.get_by_text("Время и стоимость — отдельно", exact=True).click()
        result = p.get_by_role("region", name="Результат разбора процессов")
        assert "66 ч" in result.inner_text() and "39\xa0600 ₽" in result.inner_text()
        p.get_by_role("link", name="Продолжить разбор автоматизации", exact=False).click()
        p.wait_for_url("**/tools/automation-cost"); p.get_by_role("heading", name="С чего начать", exact=True).wait_for()
        p.get_by_text("Время и стоимость — отдельно", exact=True).click(); assert "66 ч" in p.locator("main").inner_text(); assert not posts
        fit(p); assert not console, console; c.close()

        c, p, posts, console = page(width); base(p, DEMO)
        launch = p.get_by_role("button", name="Разобрать мою ситуацию с ИИ", exact=True); launch.focus(); p.keyboard.press("Enter")
        expect(p.locator("#process-description")).to_be_focused()
        panel = p.get_by_role("region", name="Индивидуальный разбор процесса")
        p.get_by_role("button", name="Проверить текст перед передачей", exact=True).click()
        assert "от 60" in panel.get_by_role("alert").inner_text(); assert not posts
        p.locator("#process-description").fill(TEXT + " client@example.test")
        p.get_by_role("button", name="Проверить текст перед передачей", exact=True).click()
        assert "контакты" in panel.get_by_role("alert").inner_text(); assert not posts
        p.locator("#process-description").fill(TEXT)
        p.locator("#process-task").select_option("crm")
        if width in [375, 1440]: capture(p, panel, f"description-{width}.png")
        p.get_by_role("button", name="Проверить текст перед передачей", exact=True).click()
        preview = p.get_by_test_id("process-payload-preview")
        assert preview.inner_text() == "Задача: Заявки и CRM\n\nОписание процесса:\n" + TEXT
        expect(p.get_by_role("heading", name="Именно этот текст будет передан в OpenAI")).to_be_focused()
        send = p.get_by_role("button", name="Показать тестовый разбор", exact=True)
        assert send.is_disabled(); p.locator("#process-consent").check()
        p.get_by_role("button", name="Вернуться и изменить текст", exact=True).click(); p.locator("#process-description").fill(TEXT + " Нужна история проверки.")
        p.get_by_role("button", name="Проверить текст перед передачей", exact=True).click()
        assert not p.locator("#process-consent").is_checked(); assert send.is_disabled(); assert not posts
        expected_text = preview.inner_text(); axe(p, "preview")
        if width in [375, 1440]: capture(p, panel, f"payload-preview-{width}.png")
        p.locator("#process-consent").focus(); p.keyboard.press("Space"); send.focus(); p.keyboard.press("Enter")
        p.get_by_role("heading", name="Демонстрационное заключение", exact=True).wait_for()
        assert len(posts) == 1 and posts[0]["body"]["consent"] is True and posts[0]["body"]["input"]["task"] == "crm"
        sent = posts[0]["body"]["input"]; assert expected_text.endswith(sent["description"])
        assert set(sent) == {"task", "description", "tools", "consequence"}
        expect(p.get_by_role("heading", name="Демонстрационное заключение", exact=True)).to_be_focused()
        assert panel.locator("ol > li").count() == 3
        assert p.get_by_role("button", name="Обсудить внедрение", exact=True).count() == 1
        assert "Нужна история проверки" not in p.evaluate("JSON.stringify({local:{...localStorage},session:{...sessionStorage}})")
        assert "описание" not in p.url and TEXT not in p.url; fit(p); axe(p, "result")
        capture(p, panel, f"analysis-result-{width}.png")
        p.get_by_role("button", name="Обсудить внедрение", exact=True).click(); assert p.locator("#lead-name").is_visible()
        assert len(posts) == 1; assert "Нужна история проверки" not in p.locator("#lead-task").input_value()
        p.get_by_role("button", name="К базовому результату без ИИ", exact=True).click()
        expect(p.get_by_role("button", name="Разобрать мою ситуацию с ИИ", exact=True)).to_be_focused()
        assert p.get_by_role("heading", name="С чего начать", exact=True).is_visible(); assert len(posts) == 1
        fit(p); assert not console, console; c.close()
        report["widths"].append({"width": width, "baselineWithoutAI": True, "labor66h39600": True, "transfer": True, "oneTask": True, "previewAndConsentReset": True, "piiBlocked": True, "noPrematurePost": True, "keyboard": True, "noOverflow": True, "demoResult": True})
        print("WIDTH", width, "PASS", flush=True)

    # Error modes never replace/hide the baseline. All responses are browser mocks.
    for status in [429, 502, 503]:
        c, p, posts, console = page(375); base(p, DEMO, multiple=False)
        p.get_by_role("button", name="Разобрать мою ситуацию с ИИ", exact=True).click(); p.locator("#process-description").fill(TEXT)
        p.get_by_role("button", name="Проверить текст перед передачей", exact=True).click(); p.locator("#process-consent").check()
        p.route("**/api/tools/process-analysis", lambda r, request, s=status: r.fulfill(status=s, json={"ok": False, "baselineAvailable": True}))
        p.get_by_role("button", name="Показать тестовый разбор", exact=True).click()
        panel = p.get_by_role("region", name="Индивидуальный разбор процесса"); panel.get_by_role("alert").wait_for()
        assert "базов" in panel.get_by_role("alert").inner_text().lower()
        assert p.get_by_role("heading", name="С чего начать", exact=True).is_visible(); fit(p)
        if status == 429: capture(p, panel, "limit-fallback-375.png")
        assert len(console) == 1 and str(status) in console[0], console
        report["expectedMockHttpErrors"] += len(console); c.close()

    assert not report["errors"], report["errors"]
    (OUT / "browser-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2)); browser.close()
