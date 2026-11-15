"""Local production-build QA. Synthetic form data, no Telegram delivery or external calls.

Requires Python Playwright/Chromium. NODE_BINARY and AXE_SCRIPT select local test tools.
Run after npm run build. Do not build concurrently. No Railway/production target is accepted.
"""
from contextlib import contextmanager
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from xml.etree import ElementTree
import json, os, re, shutil, socket, subprocess, time
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/repositioning/qa"
OUT.mkdir(parents=True, exist_ok=True)
SHOTS = OUT / "screenshots"
SHOTS.mkdir(exist_ok=True)
AXE = os.environ.get("AXE_SCRIPT")
SLUGS = ["corporate-academy", "employee-kpi", "management-analytics", "branch-standards", "lead-engine"]
PRICES = [99000, 89000, 65000, 69000, 180000]
report = {"mode": "local production build; synthetic forms; no external delivery", "http": [], "flows": [],
          "screenshots": [], "layout": [], "axe": [], "javascriptErrors": [], "externalRequests": 0,
          "formSuccesses": 0, "viewports": [], "physicalPhone": "not available", "axeStatus": "enabled" if AXE else "SKIPPED"}


@contextmanager
def server():
    env = os.environ.copy()
    for key in ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "OPENAI_API_KEY", "BUSINESS_MAP_AI_ENABLED",
                "BUSINESS_MAP_PROTOTYPE", "RAILWAY_ENVIRONMENT_NAME", "RAILWAY_ENVIRONMENT"]:
        env.pop(key, None)
    env.update(NODE_ENV="production", NEXT_PUBLIC_LEAD_FORM_EXTENDED="0")
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0)); port = sock.getsockname()[1]
    child = subprocess.Popen([os.environ.get("NODE_BINARY", shutil.which("node")), str(ROOT / "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", str(port)], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(200):
            if child.poll() is not None: raise RuntimeError("Local QA server exited")
            try:
                with socket.create_connection(("127.0.0.1", port), timeout=.2): break
            except OSError: time.sleep(.1)
        else: raise RuntimeError("Local server readiness timeout")
        yield f"http://127.0.0.1:{port}"
    finally:
        child.terminate()
        try: child.wait(timeout=5)
        except subprocess.TimeoutExpired: child.kill(); child.wait()


def http(base, path):
    try:
        with urlopen(base + path, timeout=20) as r: return r.status, r.read().decode(), dict(r.headers)
    except HTTPError as r: return r.code, r.read().decode(), dict(r.headers)


class Metadata(HTMLParser):
    def __init__(self):
        super().__init__(); self.canonical = []; self.meta = {}; self.schemas = []; self.script = False; self.raw = ""
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "link" and a.get("rel") == "canonical": self.canonical.append(a.get("href"))
        if tag == "meta": self.meta[a.get("property", a.get("name", ""))] = a.get("content")
        if tag == "script" and a.get("type") == "application/ld+json": self.script = True; self.raw = ""
    def handle_data(self, text):
        if self.script: self.raw += text
    def handle_endtag(self, tag):
        if tag == "script" and self.script: self.schemas.append(json.loads(self.raw)); self.script = False


def visit(p, base, path):
    response = p.goto(base + path, wait_until="networkidle")
    assert response.status == 200, (path, response.status)
    assert p.locator("main h1").count() == 1
    fit(p, path)


def fit(p, phase):
    data = p.evaluate("""()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
       overflow:[...document.querySelectorAll('main h1,main h2,main article,main form,main select,header nav')]
       .filter(e=>e.getBoundingClientRect().width>0 && e.scrollWidth>e.clientWidth+2)
       .map(e=>({tag:e.tagName,width:e.clientWidth,scroll:e.scrollWidth}))})""")
    report["layout"].append({"phase": phase, **data})


def capture(p, name):
    filename = str(p.viewport_size["width"]) + "-" + name + ".png"
    p.screenshot(path=str(SHOTS / filename)); report["screenshots"].append("screenshots/" + filename)


def axe(p, phase):
    if not AXE: return
    p.add_script_tag(path=AXE)
    report["axeVersion"] = p.evaluate("axe.version")
    issues = p.evaluate("""async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))""")
    report["axe"].append({"width": p.viewport_size["width"], "phase": phase, "violations": issues})


def checked(name, width, **details): report["flows"].append({"name": name, "width": width, "passed": True, **details})


try:
    # Route 404 is insufficient: draft material must not be shipped in shared client bundles.
    private_markers = ["Публичный кейс и корпоративные кадры", "Корпоративная платформа обучения для сети фитнес-клубов", "Публичный кейс не согласован"]
    client_leaks = [str(path.relative_to(ROOT)) for path in (ROOT / ".next/static").rglob("*.js")
                    if any(marker in path.read_text() for marker in private_markers)]
    report["clientBundleDraftLeaks"] = len(client_leaks)
    assert not client_leaks, "Draft text in client bundles: " + ", ".join(client_leaks)
    with server() as base:
        status, xml, _ = http(base, "/sitemap.xml"); assert status == 200
        urls = [n.text for n in ElementTree.fromstring(xml).iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
        assert len(urls) == len(set(urls))
        for url in urls:
            path = re.sub(r"^https?://[^/]+", "", url) or "/"
            status, html, headers = http(base, path)
            assert status == 200, (path, status)
            meta = Metadata(); meta.feed(html)
            assert meta.canonical == [url.rstrip("/") if path == "/" else url], (path, meta.canonical)
            assert meta.meta.get("description") and meta.meta.get("og:title") and meta.meta.get("og:description")
            assert meta.meta.get("og:url") == meta.canonical[0]
            assert "business-solutions.png" in meta.meta.get("og:image", "") or path.startswith(("/blog/", "/services/automation", "/services/apps", "/services/training", "/products/"))
            assert meta.schemas, path
            report["http"].append({"path": path, "status": status, "canonical": meta.canonical[0], "jsonLd": True})
        for path in ["/projects/corporate-learning", "/projects/employee-kpi", "/projects/branch-standards", "/projects/lead-engine", "/solutions/not-published", "/prototype/business-map", "/api/business-map/chat"]:
            status, _, _ = http(base, path); assert status == 404, (path, status)
            assert not any(path == re.sub(r"^https?://[^/]+", "", u) for u in urls)
            report["http"].append({"path": path, "status": status, "privateOrUnknown": True})
        for path in ["/privacy", "/consent"]:
            status, html, _ = http(base, path); assert status == 200
            meta = Metadata(); meta.feed(html); assert "noindex" in meta.meta.get("robots", "")
            report["http"].append({"path": path, "status": status, "noindex": True})
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), headless=True, args=["--no-sandbox"])
            report["browserVersion"] = browser.version
            for width in [320, 375, 768, 1024, 1440]:
                report["viewports"].append({"width": width, "height": 812 if width < 600 else 1000})
                c = browser.new_context(viewport=report["viewports"][-1], reduced_motion="reduce")
                p = c.new_page(); posts = []
                p.on("pageerror", lambda e: report["javascriptErrors"].append(str(e)))
                def guard(route):
                    if not route.request.url.startswith(base + "/"):
                        report["externalRequests"] += 1; route.abort()
                    else:
                        if route.request.url.endswith("/api/lead") and route.request.method == "POST": posts.append(route.request.post_data_json)
                        route.continue_()
                p.route("**/*", guard)
                visit(p, base, "/"); capture(p, "home"); axe(p, "home-hero")
                expect(p.locator("main h1")).to_have_text("Цифровые системы для управления сотрудниками, продажами и филиалами")
                assert not p.locator("#hero a[href^='/tools']").count()
                expect(p.locator("#hero").get_by_role("link", name="Обсудить проект", exact=True)).to_be_visible()
                p.locator("#hero").get_by_role("link", name="Посмотреть решения").click()
                expect(p.locator("#solutions")).to_be_in_viewport()
                assert p.locator("#solutions [data-solution]").count() == 5
                for slug, price in zip(SLUGS, PRICES):
                    card = p.locator(f'[data-solution="{slug}"]')
                    assert str(price) in re.sub(r"\s", "", card.inner_text())
                assert not p.get_by_role("link", name=re.compile("Открыть.*демо")).count()
                fit(p, "home-solutions"); capture(p, "home-solutions")
                assert any(e.get("event") == "cta_click" and e.get("location") == "hero_solutions" for e in p.evaluate("window.mrnvEvents || []"))
                p.goto(base + "/#services", wait_until="networkidle")
                expect(p.locator("#solutions")).to_be_in_viewport()
                checked("Exact hero, two actions, five prices, tools separated, CTA analytics", width)

                p.locator("#other-services summary").focus(); p.keyboard.press("Enter")
                expect(p.locator("#other-services details")).to_have_attribute("open", "")
                assert p.locator("#other-services li").count() == 8
                p.locator("#other-services summary").evaluate("e=>e.scrollIntoView({block:'start'})")
                fit(p, "other-services-open"); axe(p, "other-services-open"); capture(p, "other-services")
                p.locator("#other-services summary").focus(); p.keyboard.press("Space")
                expect(p.locator("#other-services details")).not_to_have_attribute("open", "")
                checked("Native other-services disclosure Enter/Space and eight working service URLs", width)

                if width < 1150:
                    p.get_by_role("button", name="Меню", exact=True).click()
                    expect(p.locator("#mobile-menu")).to_be_visible()
                    assert p.locator("#mobile-menu a[href^='/solutions/']").count() == 5
                    assert p.evaluate("document.body.style.overflow==='hidden'")
                    p.keyboard.press("Escape")
                    expect(p.get_by_role("button", name="Меню", exact=True)).to_be_focused()
                    assert p.evaluate("document.body.style.overflow!=='hidden'")
                    p.get_by_role("button", name="Меню", exact=True).click()
                    p.locator("#mobile-menu").get_by_role("link", name="Кейсы", exact=False).click()
                    p.wait_for_url("**/projects"); assert not p.locator("#mobile-menu").count()
                else:
                    p.get_by_role("button", name="Решения", exact=True).focus(); p.keyboard.press("Enter")
                    expect(p.locator("#services-menu")).to_be_visible()
                    p.keyboard.press("Escape")
                    expect(p.get_by_role("button", name="Решения", exact=True)).to_be_focused()
                checked("Navigation menu, Escape, focus and route close", width)

                visit(p, base, "/solutions"); capture(p, "solutions"); axe(p, "solutions")
                for slug in SLUGS:
                    visit(p, base, "/solutions/" + slug); capture(p, slug); axe(p, slug)
                    assert not p.locator("#lead-company").count() and not p.locator('input[name="direction"]').count()
                    assert not p.get_by_role("link", name=re.compile("Открыть.*демо")).count()
                    p.locator("[data-synthetic] summary").click()
                    expect(p.get_by_role("region", name="Учебная демонстрация")).to_contain_text("Синтетические данные. Не фактические результаты клиента")
                    options = p.locator("[data-synthetic] select option").count()
                    for i in range(options):
                        p.locator("[data-synthetic] select").select_option(str(i))
                        expect(p.get_by_role("region", name="Учебная демонстрация")).to_contain_text("Синтетические данные. Не фактические результаты клиента")
                        fit(p, slug + "-example-" + str(i))
                    if width in [375, 1440]:
                        p.get_by_role("region", name="Учебная демонстрация").scroll_into_view_if_needed()
                        capture(p, slug + "-synthetic")
                    events = p.evaluate("window.mrnvEvents || []")
                    assert any(e.get("event") == "solution_view" and e.get("solution") == slug for e in events)
                    p.locator("#hero").get_by_role("link", name="Обсудить проект", exact=True).click()
                    expect(p.locator("#contact")).to_be_in_viewport()
                    events = p.evaluate("window.mrnvEvents || []")
                    assert any(e.get("event") == "cta_click" and e.get("solution") == slug for e in events)
                    checked("Solution scope, gated case/demo, synthetic label, view/CTA events, form anchor", width, solution=slug)
                    if slug == "management-analytics":
                        p.get_by_role("navigation", name="Другие решения").get_by_role("link", name="Поиск и обработка клиентов", exact=False).click()
                        p.wait_for_url("**/solutions/lead-engine")
                        expect(p.locator("main h1")).to_contain_text("ИИ для поиска и обработки клиентов")
                        expect(p.locator("#lead-task")).to_have_value(re.compile("Хочу обсудить направление «ИИ для поиска"))
                        checked("Client navigation changes the solution and resets form context", width)

                for path, name in [("/services/cto", "cto"), ("/services", "services"), ("/projects", "cases"), ("/products", "products"), ("/tools", "tools"), ("/contact", "contact")]:
                    visit(p, base, path); capture(p, name); axe(p, name)
                    if path == "/services/cto":
                        assert "150000" in re.sub(r"\s", "", p.locator("#hero").inner_text())
                        expect(p.locator("#hero")).to_contain_text("30 часов")
                        expect(p.locator("main")).to_contain_text("Пример распределения 30 часов")
                        if width in [375, 1440]:
                            p.get_by_role("heading", name="Пример распределения 30 часов в месяц", exact=True).evaluate("e=>e.scrollIntoView({block:'start'})")
                            capture(p, "cto-hours")
                    if path == "/projects":
                        expect(p.locator("main")).to_contain_text("EATLYY"); expect(p.locator("main")).to_contain_text("CLUB OPS")
                        assert p.locator("main a[href='/projects/corporate-learning']").count() == 0
                    if path == "/products": assert not p.get_by_role("button", name=re.compile("Купить|Оплатить")).count()
                checked("CTO 150000/30, archives, allowed cases, preparing products and tools preserved", width)

                p.locator("#lead-name").fill("Тест")
                p.locator("#lead-phone").fill("@synthetic_test_user")
                p.locator("#lead-task").fill("Синтетическая проверка формы, без отправки сообщения владельцу")
                p.get_by_role("button", name="Отправить задачу", exact=True).click()
                expect(p.locator("#lead-consent")).to_be_focused(); assert not posts
                if width == 375:
                    p.locator("#lead-consent").check()
                    with p.expect_response(lambda r: r.url.endswith("/api/lead")) as response:
                        p.get_by_role("button", name="Отправить задачу", exact=True).click()
                    assert response.value.status == 503
                    expect(p.locator("main form").get_by_role("alert")).to_contain_text("Не получилось доставить")
                    assert not p.get_by_text("Заявка отправлена.", exact=True).count()
                    assert len(posts) == 1 and posts[0]["consent"] is True
                    assert "company" not in posts[0] and "direction" not in posts[0]
                checked("Consent blocks POST; real local unconfigured API returns honest failure, no fake success", width)
                c.close(); print(f"Repositioning browser {width}: passed", flush=True)
            browser.close()
        assert not report["javascriptErrors"] and report["externalRequests"] == 0
        assert all(item["scroll"] <= item["width"] and not item["overflow"] for item in report["layout"]), "Layout overflow: see checks.json"
        assert not any(scan["violations"] for scan in report["axe"]), "Accessibility violations: see checks.json"
        report["passed"] = True
finally:
    OUT.joinpath("checks.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
