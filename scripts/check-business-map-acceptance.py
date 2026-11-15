"""Repeatable acceptance on a LOCAL production build. Synthetic data only; no model calls.

Requires Python Playwright and Chromium. NODE_BINARY selects Node 22; AXE_SCRIPT is optional.
The runner creates ephemeral Basic credentials in process memory, starts/stops its own server,
and blocks external browser requests. AI UI checks intercept the local route with labelled stubs.
"""
from contextlib import contextmanager
from pathlib import Path
import json
import os
import re
import secrets
import shutil
import socket
import subprocess
import time
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/products/business-map/ai-dialog/acceptance"
SHOTS = OUT / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)
NODE = os.environ.get("NODE_BINARY", shutil.which("node"))
AXE = os.environ.get("AXE_SCRIPT")
DESCRIPTION = "У меня три фитнес-клуба. Менеджеры работают в Craft, руководители ежедневно собирают отчёты вручную, а часть заявок из разных каналов остаётся без внимания"
ECONOMY = "Четыре операции в день на одного сотрудника. Десять сотрудников. Двенадцать минут на операцию."
STUB_MESSAGE = "У меня три клуба, 4 сотрудника делают по 10 отчётов в день, 12 минут"
INTERPRETATION = {
    "industry": "fitness", "locations": 3, "scaleEvidence": "три клуба",
    "systems": [], "facts": [{"text": "В примере три клуба", "evidence": "три клуба"}],
    "hypotheses": [{"scenarioId": "reporting", "reason": "Возможно, есть ручная отчётность"}],
    "workloads": [{"scenarioId": "reporting", "employees": 4, "operations": 10,
                   "scope": "per-person", "period": "day", "minutes": 12,
                   "evidence": "4 сотрудника делают по 10 отчётов в день, 12 минут"}],
}
ADVICE = {
    "approach": "organize", "problem": "Ручная подготовка отчёта",
    "hypothesis": "Единый порядок может убрать повторный ввод",
    "firstStep": "Разобрать путь одного отчёта", "prepare": ["Назначить владельца"],
    "metrics": ["Минуты на отчёт с проверкой"], "risks": ["Несогласованные показатели"],
    "continueIf": "Продолжить, если качество не ухудшилось", "stopIf": "Остановить при опасной ошибке",
}
report = {"mode": "local production build; offline + intercepted browser transport; NO live OpenAI",
          "viewports": [], "flows": [], "accessibility": [], "layout": [], "screenshots": [],
          "javascriptErrors": [], "externalRequests": 0, "unstubbedAiRequests": 0,
          "physicalPhone": "not available; manual checklist required",
          "axe": "enabled" if AXE else "SKIPPED: set AXE_SCRIPT"}


@contextmanager
def server(ai_stub=False):
    env = os.environ.copy()
    for key in ["OPENAI_API_KEY", "BUSINESS_MAP_AI_ENABLED", "BUSINESS_MAP_AI_MODEL",
                "RAILWAY_ENVIRONMENT", "RAILWAY_ENVIRONMENT_NAME", "BUSINESS_MAP_PROTOTYPE",
                "SITE_NOINDEX", "BUSINESS_MAP_PREVIEW_USERNAME", "BUSINESS_MAP_PREVIEW_PASSWORD"]:
        env.pop(key, None)
    username, password = secrets.token_hex(12), secrets.token_urlsafe(32)
    env.update(NODE_ENV="production", RAILWAY_ENVIRONMENT_NAME="preview", BUSINESS_MAP_PROTOTYPE="1",
               SITE_NOINDEX="1", BUSINESS_MAP_PREVIEW_USERNAME=username, BUSINESS_MAP_PREVIEW_PASSWORD=password)
    if ai_stub:
        # A fake local flag enables UI controls. Every /chat request is intercepted below.
        env.update(BUSINESS_MAP_AI_ENABLED="1", BUSINESS_MAP_AI_MODEL="browser-transport-fixture",
                   OPENAI_API_KEY=secrets.token_hex(32))
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    child = subprocess.Popen([NODE, str(ROOT / "node_modules/next/dist/bin/next"), "start",
                              "--hostname", "127.0.0.1", "--port", str(port)],
                             cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(200):
            if child.poll() is not None:
                raise RuntimeError("Local acceptance server exited before readiness")
            try:
                with socket.create_connection(("127.0.0.1", port), timeout=.2):
                    break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError("Local acceptance server readiness timeout")
        yield f"http://127.0.0.1:{port}", {"username": username, "password": password}
    finally:
        child.terminate()
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait()


def page(browser, base, auth, width, stub=None):
    context = browser.new_context(viewport={"width": width, "height": 812 if width < 600 else 1000},
                                  http_credentials=auth, reduced_motion="reduce")
    p = context.new_page()
    p.on("pageerror", lambda error: report["javascriptErrors"].append(str(error)))

    def guard(route):
        if not route.request.url.startswith(base + "/"):
            report["externalRequests"] += 1
            route.abort()
        elif route.request.url.split("?")[0].endswith("/api/business-map/chat"):
            if stub:
                stub(route)
            else:
                report["unstubbedAiRequests"] += 1
                route.abort()
        else:
            route.continue_()
    p.route("**/*", guard)
    response = p.goto(base + "/prototype/business-map", wait_until="networkidle")
    assert response.status == 200
    return context, p


def fit(p, phase):
    data = p.evaluate("""()=>({width:innerWidth,document:document.documentElement.scrollWidth,
      containers:[...document.querySelectorAll('.bd-layout,.bd-thread,.bd-sidebar,.bd-composer')]
      .filter(e=>e.getBoundingClientRect().width>0)
      .map(e=>({name:e.className,client:e.clientWidth,scroll:e.scrollWidth}))})""")
    report["layout"].append({"phase": phase, **data})
    assert data["document"] <= data["width"], (phase, data)
    assert all(c["scroll"] <= c["client"] + 1 for c in data["containers"]), (phase, data)


def axe(p, phase):
    if not AXE:
        return
    p.add_script_tag(path=AXE)
    report["axeVersion"] = p.evaluate("axe.version")
    violations = p.evaluate("""async()=> (await axe.run(document,{runOnly:{type:'tag',
      values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact,
      nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))""")
    report["accessibility"].append({"width": p.viewport_size["width"], "phase": phase, "violations": violations})
    assert not violations, (phase, violations)


def capture(p, name):
    filename = f"{p.viewport_size['width']}-{name}.png"
    p.screenshot(path=str(SHOTS / filename))
    report["screenshots"].append("screenshots/" + filename)


def nav(p, name):
    p.get_by_role("button", name=re.compile("^Карта") if name == "Карта" else name, exact=name != "Карта").click()


def demo(p, name):
    p.get_by_label("Синтетический демо-сценарий").select_option(name)


def send(p, text):
    p.locator("#bd-message").fill(text)
    p.locator("#bd-message").press("Enter")


def reset(p):
    p.get_by_role("button", name="Начать заново", exact=True).click()


def industry_start(p):
    p.get_by_role("button", name="Фитнес и спорт", exact=True).click()
    button = p.get_by_role("button", name="Проверить", exact=True).first
    button.focus()
    p.keyboard.press("Space")


def first_detail(p):
    nav(p, "Карта")
    p.locator(".bd-layout .bd-process h3 button").first.click()


def edit(p, label, value):
    p.get_by_role("button", name="Изменить время и сведения", exact=True).click()
    expect(p.get_by_label("Название", exact=True)).to_be_focused()
    p.get_by_label(label, exact=False).fill(value)
    p.get_by_role("button", name="Сохранить и пересчитать", exact=True).click()


def checked(name, width, **facts):
    report["flows"].append({"scenario": name, "width": width, "passed": True, **facts})


try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"),
                                    headless=True, args=["--no-sandbox"])
        report["browserVersion"] = browser.version
        with server() as (base, auth):
            for width in [320, 375, 768, 1024, 1440]:
                report["viewports"].append({"width": width, "height": 812 if width < 600 else 1000})
                context, p = page(browser, base, auth, width)
                fit(p, "welcome"); axe(p, "welcome"); capture(p, "welcome")
                assert "только вымышленные данные" in p.locator(".bd-warning").inner_text()
                p.get_by_role("button", name="Фитнес и спорт", exact=True).click()
                fit(p, "library"); axe(p, "library")
                reset(p)
                p.locator("#bd-description").fill(DESCRIPTION)
                started = time.perf_counter()
                p.get_by_role("button", name="Найти возможности").click()
                expect(p.locator(".bd-messages")).to_contain_text("Первый полезный шаг")
                local_ms = round((time.perf_counter() - started) * 1000)
                assert not p.get_by_text("Да, вручную", exact=True).count()
                expect(p.locator(".bd-messages")).to_contain_text("Потерянные продажи пока не подтверждены")
                fit(p, "A-dialog"); capture(p, "scenario-a")
                nav(p, "Карта")
                assert p.locator(".bd-layout .bd-process").count() == 2
                metadata = " ".join(p.locator(".bd-layout .bd-map > p").all_inner_texts())
                assert "Craft" in metadata and "Подразделений: 3" in metadata
                assert not p.locator(".bd-layout .bd-hours").count()
                fit(p, "A-map"); axe(p, "A-map"); capture(p, "map")
                checked("A: explicit facts vs hypothesis; named software; early action", width,
                        localActionRenderMs=local_ms, mode="offline; NOT provider latency")

                reset(p); industry_start(p)
                p.get_by_role("button", name="Нет, проблемы нет", exact=True).click()
                expect(p.locator(".bd-messages")).to_contain_text("Пока не автоматизируйте")
                nav(p, "План"); expect(p.locator(".bd-plan-lead h2")).to_contain_text("Пока не автоматизировать")
                checked("B/F: No stops interview and recommends no automation", width)
                reset(p); industry_start(p)
                p.get_by_role("button", name="Да, вручную", exact=True).click()
                send(p, ECONOMY)
                p.get_by_role("button", name="Мелкая, легко исправить", exact=True).click()
                first_detail(p)
                expect(p.locator(".bm-metrics strong").first).to_contain_text("168")
                expect(p.locator(".bm-metrics strong").nth(1)).to_contain_text("Не рассчитано")
                expect(p.locator(".bm-formula")).to_contain_text("40 выполнений всей команды")
                expect(p.locator(".bm-formula")).to_contain_text("21 рабочий день")
                p.locator(".bm-formula").scroll_into_view_if_needed()
                fit(p, "C-formula"); axe(p, "C-formula"); capture(p, "formula-168")
                edit(p, "Минут на одно выполнение", "6")
                expect(p.locator(".bm-metrics strong").first).to_contain_text("84")
                p.get_by_role("button", name="Продолжить диалог", exact=True).click()
                send(p, "Исправление: 5 сотрудников")
                first_detail(p)
                expect(p.locator(".bm-metrics strong").first).to_contain_text("42")
                fit(p, "C-edit"); capture(p, "edited-42")
                p.get_by_role("button", name="Удалить процесс", exact=True).click()
                assert not p.locator(".bd-layout .bd-process").count()
                checked("C/B: 168h, no money; editor 84h; correction 42h; deletion", width)

                reset(p); industry_start(p)
                p.get_by_role("button", name="Да, вручную", exact=True).click()
                for _ in range(3):
                    p.get_by_role("button", name="Не знаю", exact=True).click()
                first_detail(p)
                expect(p.locator(".bm-metrics strong").first).to_contain_text("Не рассчитано")
                expect(p.locator(".bm-muted").filter(has_text="Для времени нужно уточнить")).to_contain_text("Частота")
                fit(p, "D-unknown"); checked("D: unknown values stay unknown; missing measurements explained", width)
                demo(p, "many")
                boxes = p.locator(".bd-checks input")
                assert boxes.count() == 7
                for i in range(5):
                    boxes.nth(i).check()
                assert boxes.nth(5).is_disabled() and boxes.nth(6).is_disabled()
                p.get_by_role("button", name="Добавить выбранные", exact=True).click()
                nav(p, "Карта"); assert p.locator(".bd-layout .bd-process").count() == 5
                fit(p, "E-limit"); checked("E: at most five processes", width)
                demo(p, "portfolio"); nav(p, "Карта")
                expect(p.locator(".bd-layout .bd-map")).to_contain_text("не складываются без проверки пересечений")
                assert p.locator(".bd-layout .bd-process").count() == 3
                expect(p.get_by_role("table", name="Матрица ценности и сложности")).to_be_visible()
                fit(p, "E-portfolio"); axe(p, "E-portfolio"); capture(p, "portfolio")
                if width in [375, 1440]:
                    p.locator(".bd-matrix").scroll_into_view_if_needed()
                    fit(p, "E-matrix-visible"); axe(p, "E-matrix-visible"); capture(p, "matrix")
                for fixture, expected in [("capacity", "Сначала сверить нагрузку"), ("critical", "автономный запуск запрещён")]:
                    demo(p, fixture); nav(p, "План")
                    expect(p.locator(".bd-plan")).to_contain_text(expected)
                    fit(p, "E-" + fixture); axe(p, "E-" + fixture)
                    if width in [375, 1440]: capture(p, fixture + "-plan")
                demo(p, "risk"); nav(p, "Карта")
                expect(p.locator(".bd-layout .bd-process").first).to_contain_text("Сначала подготовить")
                demo(p, "payback"); nav(p, "Карта")
                expect(p.locator(".bd-layout .bd-map")).to_contain_text("Не окупается по прямой экономии")
                checked("E: portfolio, risk, W-CAPACITY, critical stop and no payback", width)

                demo(p, "correction"); first_detail(p)
                edit(p, "Количество выполнений за период", "8")
                nav(p, "Диалог"); assert not p.locator(".bd-proposal").count()
                demo(p, "correction"); first_detail(p)
                p.get_by_role("button", name="Удалить процесс", exact=True).click()
                nav(p, "Диалог"); assert not p.locator(".bd-proposal").count()
                checked("E: pending demo interpretation disappears after edit/deletion", width)

                demo(p, "conversation")
                send(p, "Синтетическое длинное уточнение " * 120)
                assert p.locator("#bd-message").input_value() == ""  # Within 4,000 characters.
                too_long = "я" * 4001
                p.locator("#bd-message").fill(too_long); p.locator("#bd-message").press("Enter")
                assert p.locator("#bd-message").input_value() == too_long
                expect(p.get_by_role("status")).to_contain_text("Текст оставлен")
                fit(p, "long-message"); checked("long messages wrap; oversized draft retained; keyboard Enter", width)
                assert p.evaluate("localStorage.length===0 && sessionStorage.length===0")
                p.reload(wait_until="networkidle")
                expect(p.locator("#bd-description")).to_have_value("")
                checked("reload clears tab-memory data; no browser storage", width)
                context.close()
                print(f"Offline acceptance {width}: passed", flush=True)

            context, p = page(browser, base, auth, 375)
            demo(p, "conversation")
            button = p.get_by_role("button", name=re.compile("^Карта"))
            button.focus(); p.keyboard.press("Enter")
            expect(p.get_by_role("heading", name="От слов к процессам", exact=True)).to_be_focused()
            p.keyboard.press("Tab")
            expect(p.locator(".bd-layout .bd-process h3 button").first).to_be_focused()
            p.keyboard.press("Enter")
            expect(p.locator(".bd-layout h1")).to_be_focused()
            nav(p, "Диалог")
            p.set_viewport_size({"width": 375, "height": 440})
            fit(p, "short-viewport-not-physical-keyboard")
            composer = p.locator(".bd-composer").bounding_box()
            mobile_nav = p.locator(".bd-mobile-tabs").bounding_box()
            if mobile_nav:
                assert composer["y"] + composer["height"] <= mobile_nav["y"] + 1
            assert composer["y"] + composer["height"] <= 440
            checked("keyboard Tab/Enter focus; short viewport reflow (NOT phone IME)", 375)
            context.close()

        with server(ai_stub=True) as (base, auth):
            pending = []
            context, p = page(browser, base, auth, 375, lambda route: pending.append(route))
            p.locator("#bd-description").fill(STUB_MESSAGE)
            p.get_by_role("button", name="Найти возможности").click()
            expect(p.get_by_role("status").filter(has_text="OpenAI разбирает")).to_be_visible()
            assert len(pending) == 1
            first_detail(p); edit(p, "Количество выполнений за период", "8")
            pending.pop().fulfill(status=200, json={"ok": True, "source": "openai", "interpretation": INTERPRETATION, "advice": None})
            expect(p.get_by_role("status")).to_contain_text("Устаревший ответ ИИ не применён")
            nav(p, "Диалог"); assert not p.locator(".bd-proposal").count()
            checked("late Interpreter response after manual edit ignored", 375, mode="intercepted transport; NO OpenAI")
            demo(p, "portfolio"); nav(p, "План")
            p.get_by_role("button", name="Уточнить план с OpenAI", exact=True).click()
            expect(p.get_by_role("button", name="Готовим объяснение…", exact=True)).to_be_disabled()
            first_detail(p); edit(p, "Минут на одно выполнение", "6")
            assert len(pending) == 1
            pending.pop().fulfill(status=200, json={"ok": True, "source": "openai", "interpretation": None, "advice": ADVICE})
            expect(p.get_by_role("status")).to_contain_text("Устаревший ответ ИИ не применён")
            nav(p, "План")
            expect(p.locator(".bd-plan .bm-page-heading")).to_contain_text("без ИИ")
            checked("late Advisor response after edit ignored", 375, mode="intercepted transport; NO OpenAI")
            context.close()

            for status, code in [(429, "rate_limit"), (502, "provider_error"), (504, "timeout")]:
                calls = []
                def fail(route):
                    calls.append(True)
                    route.fulfill(status=status, json={"ok": False, "source": "unavailable", "code": code,
                                  "error": "Синтетический сбой ИИ. Можно продолжить без него."})
                context, p = page(browser, base, auth, 375, fail)
                p.locator("#bd-description").fill(STUB_MESSAGE)
                p.get_by_role("button", name="Найти возможности").click()
                expect(p.locator(".bd-messages")).to_contain_text("Синтетический сбой ИИ")
                nav(p, "Карта"); assert p.locator(".bd-layout .bd-process").count() == 1
                assert len(calls) == 1
                fit(p, "stub-error")
                checked("AI error preserves map; no automatic retry", 375, status=status, mode="browser transport stub; NO provider")
                context.close()

            ids = []
            def budget_error(route):
                ids.append(route.request.post_data_json["requestId"])
                route.fulfill(status=502, json={"ok": False, "source": "unavailable", "code": "provider_error",
                              "error": f"Синтетический сбой для проверки лимита вкладки: {len(ids)}."})
            context, p = page(browser, base, auth, 375, budget_error)
            p.locator("#bd-description").fill(STUB_MESSAGE)
            p.get_by_role("button", name="Найти возможности").click()
            expect(p.locator(".bd-message").last).to_contain_text("Синтетический сбой для проверки лимита вкладки: 1.")
            for number in range(2, 9):
                send(p, "Уточните синтетическую ситуацию")
                expect(p.locator(".bd-message").last).to_contain_text(f"Синтетический сбой для проверки лимита вкладки: {number}.")
            send(p, "Уточните синтетическую ситуацию")
            expect(p.get_by_role("status")).to_contain_text("Достигнут лимит ИИ этой вкладки")
            assert len(ids) == 8 and len(set(ids)) == 8
            checked("browser eight-call cap blocks ninth; unique request IDs", 375,
                    calls=len(ids), mode="intercepted transport; server budget tested separately")
            context.close()
        browser.close()
    assert not report["javascriptErrors"], report["javascriptErrors"]
    assert report["externalRequests"] == 0
    assert report["unstubbedAiRequests"] == 0
    report["passed"] = True
finally:
    OUT.joinpath("browser-check.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
