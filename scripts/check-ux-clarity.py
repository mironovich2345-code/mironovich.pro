"""UX clarity QA: local production build, synthetic form data, no Telegram delivery or external calls.

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
OUT = ROOT / "docs/ux-clarity/after"
OUT.mkdir(parents=True, exist_ok=True)
SHOTS = OUT / "screenshots"
SHOTS.mkdir(exist_ok=True)
AXE = os.environ.get("AXE_SCRIPT")
SLUGS = ["corporate-academy", "employee-kpi", "management-analytics", "branch-standards", "lead-engine"]
PRICES = [99000, 89000, 65000, 69000, 180000]
report = {"mode": "local production build; synthetic forms; no external delivery", "http": [], "flows": [],
          "screenshots": [], "layout": [], "axe": [], "javascriptErrors": [], "externalRequests": 0,
          "formSuccesses": 0, "journeys": [], "topicLinks": [], "homeSections": [], "compatibility": [], "viewports": [], "physicalPhone": "not available", "axeStatus": "enabled" if AXE else "SKIPPED"}


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
    # The browser does not issue another HTTP request for a same-document hash.
    if response is None:
        assert '#' in path and p.url == base + path, (path, p.url)
    else:
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


TOPICS = [
    ("crm", "automation", "Настройка CRM"), ("api", "automation", "API-интеграции"),
    ("ai-assistants", "development", "ИИ-помощники"), ("sales-trainers", "training", "ИИ-тренажёры продаж"),
    ("voice-ai", "automation", "Голосовые ИИ-интеграции"), ("custom-crm", "apps", "Специализированные CRM"),
    ("expertise", "expertise", "Техническая экспертиза"), ("support", "support", "Техническое сопровождение"),
]


def event(p, name, **params):
    return any(e.get('event') == name and all(e.get(k) == v for k,v in params.items())
               for e in p.evaluate('window.mrnvEvents || []'))


def wait_event(p, name, **params):
    # Native toggle and React effects can follow DOM visibility by one event loop.
    p.wait_for_function("""({name,params})=>(window.mrnvEvents || []).some(e =>
        e.event === name && Object.entries(params).every(([k,v])=>e[k]===v))""",
        arg={'name':name,'params':params}, timeout=5000)
    return True


def target_visible(p, selector):
    box = p.locator(selector).bounding_box()
    header = p.locator('header').bounding_box()
    assert box and header and box['y'] >= header['y'] + header['height'] - 1, (selector, box, header)
    assert box['y'] + box['height'] < p.viewport_size['height'], (selector, box)
    return round(box['y'], 1)


try:
    private_markers = ["Публичный кейс и корпоративные кадры", "Корпоративная платформа обучения для сети фитнес-клубов", "Публичный кейс не согласован"]
    client_leaks = [str(path.relative_to(ROOT)) for path in (ROOT / '.next/static').rglob('*.js')
                    if any(marker in path.read_text() for marker in private_markers)]
    report['clientBundleDraftLeaks'] = len(client_leaks)
    assert not client_leaks, client_leaks
    with server() as base:
        status, xml, _ = http(base, '/sitemap.xml'); assert status == 200
        urls = [n.text for n in ElementTree.fromstring(xml).iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        assert len(urls) == len(set(urls))
        for url in urls:
            path = re.sub(r'^https?://[^/]+', '', url) or '/'
            status, html, _ = http(base, path); assert status == 200, (path,status)
            assert not any(marker in html for marker in private_markers), path
            meta = Metadata(); meta.feed(html)
            assert meta.canonical == [url.rstrip('/') if path == '/' else url], (path,meta.canonical)
            assert meta.meta.get('description') and meta.meta.get('og:title') and meta.meta.get('og:description')
            assert meta.meta.get('og:url') == meta.canonical[0] and meta.schemas, path
            if path == '/products/ai-career':
                assert 'Как стать ценнее' in meta.meta['og:title']
                assert 'ai-career-v2.png' in meta.meta['og:image']
                assert '947' not in re.sub(r'<[^>]+>', '', html)
            report['http'].append({'path':path,'status':status,'canonical':meta.canonical[0],'jsonLd':True})
        for path in ['/projects/corporate-learning','/projects/employee-kpi','/projects/branch-standards','/projects/lead-engine','/solutions/not-published','/prototype/business-map','/api/business-map/chat']:
            status, _, _ = http(base,path); assert status == 404, (path,status)
            assert not any(path == re.sub(r'^https?://[^/]+','',u) for u in urls)
            report['http'].append({'path':path,'status':status,'privateOrUnknown':True})
        for path in ['/privacy','/consent']:
            status, html, _ = http(base,path); assert status == 200
            meta=Metadata(); meta.feed(html); assert 'noindex' in meta.meta.get('robots','')
            report['http'].append({'path':path,'status':status,'noindex':True})
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
            report['browserVersion']=browser.version
            for width in [320,375,768,1024,1440]:
                viewport={'width':width,'height':812 if width<600 else 1000}; report['viewports'].append(viewport)
                c=browser.new_context(viewport=viewport,reduced_motion='reduce'); p=c.new_page(); posts=[]
                p.on('pageerror',lambda e:report['javascriptErrors'].append(str(e)))
                def guard(route):
                    if not route.request.url.startswith(base+'/'):
                        report['externalRequests']+=1; route.abort()
                    else:
                        if route.request.url.endswith('/api/lead') and route.request.method=='POST': posts.append(route.request.post_data_json)
                        route.continue_()
                p.route('**/*',guard)
                visit(p,base,'/'); capture(p,'home'); axe(p,'home')
                expect(p.locator('main h1')).to_have_text('Технологии для бизнеса. ИИ для сотрудников.')
                expect(p.locator('#hero a[href="#contact"]')).to_contain_text('Запросить консультацию')
                assert p.locator('[data-direction]').count()==6
                ids=p.locator('main > section').evaluate_all('(xs)=>xs.map(e=>({id:e.id,height:Math.round(e.getBoundingClientRect().height)}))')
                assert [s['id'] for s in ids] == ['hero','solutions','projects','cto','other-services','process','faq','contact']
                report['homeSections'].append({'width':width,'height':p.evaluate('document.documentElement.scrollHeight'),'sections':ids})
                if width==375:
                    p.locator('#hero a[href="/products/ai-career"]').evaluate("e=>e.scrollIntoView({block:'start'})")
                    capture(p,'hero-employee')
                for slug,price in zip(SLUGS,PRICES):
                    text=p.locator('[data-direction="'+slug+'"]').inner_text()
                    assert str(price) in re.sub(r'\s','',text)
                    assert 'Полный проект' not in text and 'демо' not in text
                p.locator('#solutions').evaluate("e=>e.scrollIntoView({block:'start'})"); capture(p,'services'); axe(p,'services')
                assert not p.get_by_role('link',name=re.compile('Открыть.*демо')).count()
                expect(p.locator('#projects')).to_contain_text('EATLYY'); expect(p.locator('#projects')).to_contain_text('CLUB OPS')
                assert p.locator('#projects a[href="/projects"]').count()==1
                p.locator('#projects').evaluate("e=>e.scrollIntoView({block:'start'})"); capture(p,'cases')
                p.locator('#cto').evaluate("e=>e.scrollIntoView({block:'start'})"); capture(p,'cto'); axe(p,'cto')
                expect(p.locator('#cto')).to_contain_text('30 часов')
                assert '150000' in re.sub(r'\s','',p.locator('#cto').inner_text())
                if width<760:
                    for title in ['Программист','Агентство разработки']:
                        summary=p.locator('#cto summary').filter(has_text=title); summary.focus(); p.keyboard.press('Enter')
                        expect(summary.locator('..')).to_have_attribute('open','')
                        summary.focus(); p.keyboard.press('Space'); expect(summary.locator('..')).not_to_have_attribute('open','')
                else:
                    expect(p.locator('#cto table')).to_be_visible(); assert p.locator('#cto table tbody tr').count()==5
                checked('Six offers with original prices; source portfolio; CTO typical roles and scope',width)
                # Hero primary contact and distinct calculator entry.
                visit(p,base,'/'); p.locator('#hero a[href="#contact"]').click()
                expect(p.locator('#contact')).to_be_in_viewport(); assert wait_event(p,'cta_click',location='hero')
                visit(p,base,'/'); p.locator('#hero a[href="/tools/labor-cost"]').click(); p.wait_for_url('**/tools/labor-cost')
                assert wait_event(p,'cta_click',location='hero_calculator',tool='labor')
                assert p.locator('main').inner_text(); checked('Hero primary contact and calculator entry',width)
                # Employee journey: one click, honest status and no checkout.
                visit(p,base,'/'); p.locator('#hero a[href="/products/ai-career"]').click(); p.wait_for_url('**/products/ai-career')
                expect(p.locator('main h1')).to_have_text('Как стать ценнее для компании с помощью ИИ')
                expect(p.locator('main [role="status"]')).to_contain_text('пока не продаётся')
                assert '1990₽' in re.sub(r'\s','',p.locator('main').inner_text())
                assert not p.get_by_role('button',name=re.compile('Купить|Оплатить')).count()
                assert p.locator('main section ol li').count()==6
                assert wait_event(p,'cta_click',location='hero_product',product='ai-career')
                capture(p,'ai-career'); axe(p,'ai-career'); fit(p,'ai-career')
                if width in [375,1440]:
                    p.locator('main img').first.evaluate("e=>e.scrollIntoView({block:'start'})")
                    capture(p,'ai-career-cover')
                report['journeys'].append({'role':'employee','width':width,'clicksToProduct':1,'preparing':True,'purchase':False})
                # Owner/HR/operations: real clicks from home to the pilot and its form.
                for role,slug in [('owner','management-analytics'),('owner-kpi','employee-kpi'),('hr','corporate-academy'),('operations','branch-standards'),('sales','lead-engine')]:
                    visit(p,base,'/'); p.locator('#solutions a[href="/solutions/'+slug+'"]').click(); p.wait_for_url('**/solutions/'+slug)
                    assert wait_event(p,'cta_click',location='direction_list',solution=slug)
                    assert wait_event(p,'solution_view',solution=slug)
                    capture(p,role+'-offer'); axe(p,slug); fit(p,slug)
                    assert not p.locator('#lead-company').count() and not p.locator('input[name="direction"]').count()
                    p.locator('[data-synthetic] summary').click()
                    expect(p.get_by_role('region',name='Учебная демонстрация')).to_contain_text('Синтетические данные. Не фактические результаты клиента')
                    for i in range(p.locator('[data-synthetic] select option').count()):
                        p.locator('[data-synthetic] select').select_option(str(i)); fit(p,slug+'-synthetic-'+str(i))
                    if width in [375,1440] and slug=='corporate-academy':
                        p.get_by_role('region',name='Учебная демонстрация').scroll_into_view_if_needed(); capture(p,'hr-synthetic')
                    p.locator('#hero').get_by_role('link',name='Обсудить проект',exact=True).click()
                    expect(p.locator('#contact')).to_be_in_viewport(); assert wait_event(p,'cta_click',solution=slug,location='solution_page')
                    report['journeys'].append({'role':role,'width':width,'clicksToForm':2,'solution':slug,'syntheticLabel':True})
                visit(p,base,'/'); p.locator('[data-direction="cto"] a').click(); p.wait_for_url('**/services/cto')
                assert wait_event(p,'cta_click',location='direction_list',service='cto')
                visit(p,base,'/'); p.locator('#cto a[href="/services/cto"]').click(); p.wait_for_url('**/services/cto')
                assert wait_event(p,'cta_click',location='cto_comparison',service='cto')
                expect(p.locator('#hero')).to_contain_text('30 часов')
                assert '150000' in re.sub(r'\s','',p.locator('#hero').inner_text())
                expect(p.locator('main')).to_contain_text('Пример распределения 30 часов')
                capture(p,'cto-offer'); axe(p,'cto-offer'); fit(p,'cto-offer')
                p.locator('#hero').get_by_role('link',name='Обсудить задачу бесплатно',exact=True).click(); expect(p.locator('#contact')).to_be_in_viewport()
                report['journeys'].append({'role':'cto','width':width,'clicksToForm':2,'comparisonOnHome':True,'scope':True})
                checked('Owner, HR, employee and CTO journeys with distinct safe analytics',width)
                # Native disclosure, then all eight client-side anchor transitions.
                visit(p,base,'/'); summary=p.locator('#other-services summary'); summary.focus(); p.keyboard.press('Enter')
                expect(p.locator('#other-services details')).to_have_attribute('open','')
                assert wait_event(p,'additional_services_open',location='other_services')
                p.locator('#other-services').evaluate("e=>e.scrollIntoView({block:'start'})"); capture(p,'other-services'); axe(p,'other-services')
                summary.focus(); p.keyboard.press('Space'); expect(p.locator('#other-services details')).not_to_have_attribute('open','')
                for topic,service,title in TOPICS:
                    visit(p,base,'/'); p.locator('#other-services summary').click()
                    href='/services/'+service+'#'+topic
                    p.locator('#other-services a[href="'+href+'"]').click(); p.wait_for_url('**'+href); p.wait_for_load_state('networkidle')
                    heading=p.locator('h2#'+topic); expect(heading).to_have_text(title)
                    top=target_visible(p,'h2#'+topic)
                    assert wait_event(p,'cta_click',location='other_services',service=service,topic=topic)
                    article=p.locator('[data-service-topic="'+topic+'"]'); expect(article).to_contain_text('Результат:')
                    fit(p,topic+'-anchor'); axe(p,topic+'-anchor')
                    if width in [375,1440]: capture(p,'topic-'+topic)
                    article.get_by_role('link',name='Обсудить эту задачу').click(); expect(p.locator('#contact')).to_be_in_viewport()
                    assert wait_event(p,'cta_click',location='service_topic',service=service,topic=topic)
                    report['topicLinks'].append({'width':width,'href':href,'heading':title,'headingTop':top,'result':True,'form':True,'clientNavigation':True})
                    # Fresh URL opening as well as Next Link navigation.
                    p.goto('about:blank')
                    visit(p,base,href); target_visible(p,'h2#'+topic)
                checked('Eight links: HTTP route, topic/result, visible heading, sticky offset, form, analytics; direct and client navigation',width)
                visit(p,base,'/'); p.locator('#other-services summary').click()
                p.locator('#other-services').get_by_role('link',name='Посмотреть все возможности').click()
                p.wait_for_url('**/services'); expect(p.locator('main h1')).to_be_visible()
                for anchor,selector in [('services','#solutions'),('about','#about')]:
                    visit(p,base,'/#'+anchor); expect(p.locator(selector)).to_be_in_viewport()
                    report['compatibility'].append({'width':width,'href':'/#'+anchor,'visible':True})
                checked('Sixth direction CTO, all-capabilities link and legacy home anchors',width)
                visit(p,base,'/')
                if width<1150:
                    button=p.get_by_role('button',name='Меню',exact=True); button.focus(); p.keyboard.press('Enter')
                    expect(p.locator('#mobile-menu')).to_be_visible(); assert p.evaluate("document.body.style.overflow==='hidden'")
                    if width==375: capture(p,'menu')
                    fit(p,'menu-open'); axe(p,'menu-open')
                    p.keyboard.press('Escape'); expect(button).to_be_focused()
                    assert p.evaluate("document.body.style.overflow!=='hidden'")
                    button.click(); p.locator('#mobile-menu').get_by_role('link',name='Кейсы',exact=False).click(); p.wait_for_url('**/projects')
                    assert not p.locator('#mobile-menu').count()
                else:
                    button=p.get_by_role('button',name='Решения',exact=True); button.focus(); p.keyboard.press('Space')
                    expect(p.locator('#services-menu')).to_be_visible(); capture(p,'menu')
                    fit(p,'menu-open'); axe(p,'menu-open')
                    p.keyboard.press('Escape'); expect(button).to_be_focused()
                checked('Enter/Space disclosure, Escape focus restore and menu route close',width)
                for path,name in [('/solutions','solutions'),('/services','services-catalogue'),('/tools','tools'),('/projects','projects'),('/products','products'),('/contact','contact')]:
                    visit(p,base,path); axe(p,name); fit(p,name)
                    if path=='/tools': expect(p.locator('main a[href="/tools/automation-cost"]')).to_be_visible()
                    if path=='/solutions': assert p.locator('[data-direction]').count()==6
                    if width in [375,1440] or path=='/contact': capture(p,name)
                # A real local backend failure, never a simulated success/delivery.
                p.locator('#lead-name').fill('Тест'); p.locator('#lead-phone').fill('@synthetic_test_user')
                p.locator('#lead-task').fill('Синтетическая проверка формы, без отправки сообщения владельцу')
                assert wait_event(p,'form_start')
                assert sum(e.get('event')=='form_start' for e in p.evaluate('window.mrnvEvents || []'))==1
                p.get_by_role('button',name='Отправить задачу',exact=True).click(); expect(p.locator('#lead-consent')).to_be_focused(); assert not posts
                if width==375:
                    p.locator('#lead-consent').check()
                    with p.expect_response(lambda r:r.url.endswith('/api/lead')) as response: p.get_by_role('button',name='Отправить задачу',exact=True).click()
                    assert response.value.status==503
                    expect(p.locator('main form').get_by_role('alert')).to_contain_text('Не получилось доставить')
                    assert len(posts)==1 and posts[0]['consent'] is True and 'company' not in posts[0]
                    capture(p,'form-error')
                assert not event(p,'lead_submit_success')
                assert not any('@synthetic' in json.dumps(e) or 'Синтетическая проверка' in json.dumps(e,ensure_ascii=False) for e in p.evaluate('window.mrnvEvents || []'))
                checked('Form start once, consent, no added fields, unconfigured backend honest 503, no false success/PII',width)
                if width in [375,1440]:
                    visit(p,base,'/'); p.screenshot(path=str(SHOTS/f'{width}-home-full.png'),full_page=True)
                c.close(); print(f'UX browser {width}: passed',flush=True)
            browser.close()
        assert not report['javascriptErrors'] and report['externalRequests']==0
        assert all(item['scroll']<=item['width'] and not item['overflow'] for item in report['layout']), 'Layout overflow; see checks.json'
        assert not any(scan['violations'] for scan in report['axe']), 'Accessibility violations; see checks.json'
        report['passed']=True
finally:
    OUT.joinpath('checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
