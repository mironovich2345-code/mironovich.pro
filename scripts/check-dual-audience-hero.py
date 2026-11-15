"""Dual audience Hero acceptance: local production build, synthetic form data, no external delivery.

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

import argparse
args = argparse.ArgumentParser(description="Local PR 14 acceptance or baseline capture")
args.add_argument("--phase", choices=["before","after"], default="after")
phase = args.parse_args().phase
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/dual-audience-hero" / phase
OUT.mkdir(parents=True, exist_ok=True)
SHOTS = OUT / "screenshots"
SHOTS.mkdir(exist_ok=True)
AXE = os.environ.get("AXE_SCRIPT")
SLUGS = ["corporate-academy", "employee-kpi", "management-analytics", "branch-standards", "lead-engine"]
PRICES = [99000, 89000, 65000, 69000, 180000]
report = {"phase": phase, "measurements": [], "navigation": [], "mode": "local production build; synthetic forms; no external delivery", "http": [], "flows": [],
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
       .filter(e=>e.getBoundingClientRect().width>1 && e.getBoundingClientRect().height>1 && e.scrollWidth>e.clientWidth+2)
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


VIEWPORTS = [{'width':375,'height':812},{'width':390,'height':844},{'width':768,'height':1024},{'width':1024,'height':900},{'width':1440,'height':900}]


def measure(p):
    data=p.evaluate("""()=>{
      const box=(e)=>{const r=e.getBoundingClientRect(); return {top:Math.round(r.top),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height),within:r.top>=0&&r.bottom<=innerHeight}};
      const header=document.querySelector('header'),hero=document.getElementById('hero');
      const cards=[...hero.querySelectorAll('article')];
      const consultation=hero.querySelector('a[href="#contact"]'),employee=hero.querySelector('a[href="/products/ai-career"]');
      return {width:innerWidth,height:innerHeight,documentHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,
        header:box(header),hero:box(hero),h1:box(hero.querySelector('h1')),consultation:box(consultation),employeeLink:box(employee),
        employeePrice:box([...cards[1].querySelectorAll('p')].find(e=>e.innerText.includes('₽'))),
        cards:cards.map(box)}
    }""")
    report['measurements'].append(data)
    return data


def has_event(p,name,**params):
    return any(e.get('event')==name and all(e.get(k)==v for k,v in params.items()) for e in p.evaluate('window.mrnvEvents || []'))


def await_event(p,name,**params):
    p.wait_for_function("({name,params})=>(window.mrnvEvents||[]).some(e=>e.event===name&&Object.entries(params).every(([k,v])=>e[k]===v))",arg={'name':name,'params':params},timeout=5000)


try:
    with server() as base:
        if phase=='after':
            status,xml,_=http(base,'/sitemap.xml');assert status==200
            urls=[n.text for n in ElementTree.fromstring(xml).iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
            assert len(urls)==len(set(urls))
            for url in urls:
                path=re.sub(r'^https?://[^/]+','',url) or '/'
                status,html,_=http(base,path);assert status==200,(path,status)
                meta=Metadata();meta.feed(html)
                assert meta.canonical==[url.rstrip('/') if path=='/' else url],(path,meta.canonical)
                assert meta.meta.get('description') and meta.meta.get('og:title') and meta.schemas,path
                assert meta.meta.get('og:url')==meta.canonical[0]
                if path=='/products/ai-career':assert 'Как стать ценнее' in meta.meta['og:title']
                report['http'].append({'path':path,'status':status,'canonical':meta.canonical[0],'jsonLd':True})
            for path in ['/privacy','/consent']:
                status,html,_=http(base,path);assert status==200
                meta=Metadata();meta.feed(html);assert 'noindex' in meta.meta.get('robots','')
                report['http'].append({'path':path,'status':status,'noindex':True})
            for path in ['/projects/corporate-learning','/projects/employee-kpi','/projects/branch-standards','/projects/lead-engine','/prototype/business-map','/api/business-map/chat']:
                status,_,_=http(base,path);assert status==404,(path,status)
                report['http'].append({'path':path,'status':status,'privateOrUnknown':True})
            markers=['Публичный кейс и корпоративные кадры','Корпоративная платформа обучения для сети фитнес-клубов','Публичный кейс не согласован']
            leaks=[str(p.relative_to(ROOT)) for p in (ROOT/'.next/static').rglob('*.js') if any(m in p.read_text() for m in markers)]
            report['clientBundleDraftLeaks']=len(leaks);assert not leaks,leaks
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
            report['browserVersion']=browser.version
            for viewport in VIEWPORTS:
                report['viewports'].append(viewport);width=viewport['width']
                c=browser.new_context(viewport=viewport,reduced_motion='reduce');p=c.new_page();posts=[]
                p.on('pageerror',lambda e:report['javascriptErrors'].append(str(e)))
                def guard(route):
                    if not route.request.url.startswith(base+'/'):
                        report['externalRequests']+=1;route.abort()
                    else:
                        if route.request.url.endswith('/api/lead') and route.request.method=='POST':posts.append(route.request.post_data_json)
                        route.continue_()
                p.route('**/*',guard)
                visit(p,base,'/');capture(p,'home');axe(p,'home');geometry=measure(p)
                if phase=='after':
                    assert geometry['consultation']['within'],('Consultation below initial viewport',geometry)
                    assert geometry['employeePrice']['within'],('Employee price below initial viewport',geometry)
                expect(p.locator('#hero h1')).to_have_text('Технологии для бизнеса. ИИ для сотрудников.')
                expect(p.locator('#hero')).to_contain_text('Для компаний');expect(p.locator('#hero')).to_contain_text('Для сотрудников')
                expect(p.locator('#hero')).to_contain_text('Готовится к запуску')
                assert '1990₽' in re.sub(r'\s','',p.locator('#hero').inner_text())
                # Both audience cards, and the employee destination, at the same CSS widths.
                p.locator('#hero article').first.evaluate("e=>e.scrollIntoView({block:'start'})");capture(p,'audiences')
                p.locator('#hero a[href="/products/ai-career"]').click();p.wait_for_url('**/products/ai-career')
                expect(p.locator('main [role="status"]')).to_contain_text('пока не продаётся')
                assert '1990₽' in re.sub(r'\s','',p.locator('main').inner_text())
                assert not p.get_by_role('button',name=re.compile('Купить|Оплатить')).count()
                assert not p.get_by_role('link',name=re.compile('Купить|Оплатить')).count()
                assert p.locator('main section ol li').count()==6
                await_event(p,'cta_click',location='hero_product',product='ai-career')
                capture(p,'employee-product');axe(p,'employee-product');fit(p,'employee-product')
                if phase=='after':
                    checked('Hero two audiences; single employee product at 1990 RUB, preparing, no checkout; safe CTA event',width)
                    p.locator('main img').first.evaluate("e=>e.scrollIntoView({block:'start'})");capture(p,'employee-programme')
                visit(p,base,'/products');capture(p,'products');axe(p,'products')
                card=p.locator('main article').filter(has=p.locator('a[href="/products/ai-career"]')).first
                assert '1990₽' in re.sub(r'\s','',card.inner_text())
                expect(card).to_contain_text('Готовится')
                visit(p,base,'/')
                button=p.get_by_role('button',name='Меню' if width<1150 else 'Решения',exact=True)
                button.focus();p.keyboard.press('Enter')
                menu=p.locator('#mobile-menu' if width<1150 else '#services-menu');expect(menu).to_be_visible()
                capture(p,'menu');axe(p,'menu-open');fit(p,'menu-open')
                if width<1150:expect(menu.get_by_role('link',name='Сотрудникам',exact=True)).to_be_visible()
                else:expect(p.locator('header').get_by_role('link',name='Сотрудникам',exact=True)).to_be_visible()
                p.keyboard.press('Escape');expect(button).to_be_focused()
                if phase=='after':
                    if width<1150:
                        button.click();menu.get_by_role('link',name='Сотрудникам',exact=True).click()
                    else:p.locator('header').get_by_role('link',name='Сотрудникам',exact=True).click()
                    p.wait_for_url('**/products/ai-career');assert not p.locator('#mobile-menu').count()
                    assert p.evaluate("document.body.style.overflow!=='hidden'")
                    checked('Employee link in desktop/mobile navigation; Enter/Escape, focus and route close',width)
                    # Consultation must also work when opened from the employee page.
                    if width<1150:
                        toggle=p.get_by_role('button',name='Меню',exact=True);toggle.focus();p.keyboard.press('Space')
                        expect(p.locator('#mobile-menu')).to_be_visible()
                        p.locator('#mobile-menu').get_by_role('link',name='Запросить консультацию',exact=True).click()
                    else:p.locator('header').get_by_role('link',name='Консультация',exact=True).click()
                    p.wait_for_url('**/contact');expect(p.locator('#contact form')).to_be_visible()
                    p.locator('#contact').scroll_into_view_if_needed();expect(p.locator('#contact')).to_be_in_viewport()
                    await_event(p,'cta_click',location='header');fit(p,'header-consultation')
                    assert not p.locator('#mobile-menu').count()
                    checked('Header/mobile company consultation from employee route; Space activation, existing contact page/form and safe event',width)
                    visit(p,base,'/');p.locator('#hero a[href="#contact"]').click();expect(p.locator('#contact')).to_be_in_viewport()
                    await_event(p,'cta_click',location='hero');capture(p,'consultation-form');axe(p,'consultation-form');fit(p,'consultation-form')
                    # No real lead can leave this local process: credentials are removed by server().
                    p.locator('#lead-name').fill('Тест');p.locator('#lead-phone').fill('@synthetic_test_user')
                    p.locator('#lead-task').fill('Синтетическая проверка консультации, без отправки сообщения владельцу')
                    await_event(p,'form_start')
                    p.get_by_role('button',name='Отправить задачу',exact=True).click();expect(p.locator('#lead-consent')).to_be_focused();assert not posts
                    if width==375:
                        p.locator('#lead-consent').check()
                        with p.expect_response(lambda r:r.url.endswith('/api/lead')) as response:p.get_by_role('button',name='Отправить задачу',exact=True).click()
                        assert response.value.status==503
                        expect(p.locator('main form').get_by_role('alert')).to_contain_text('Не получилось доставить')
                        assert len(posts)==1 and posts[0]['consent'] is True
                        capture(p,'form-error')
                    assert not has_event(p,'lead_submit_success')
                    assert not any('@synthetic' in json.dumps(e) or 'Синтетическая проверка' in json.dumps(e,ensure_ascii=False) for e in p.evaluate('window.mrnvEvents || []'))
                    checked('Company consultation form; consent, form_start, honest local delivery failure, no false success/PII',width)
                    visit(p,base,'/');p.locator('#hero a[href="/tools/labor-cost"]').click();p.wait_for_url('**/tools/labor-cost')
                    await_event(p,'cta_click',location='hero_calculator',tool='labor');fit(p,'labor-calculator')
                    visit(p,base,'/tools');expect(p.locator('main a[href="/tools/automation-cost"]')).to_be_visible();fit(p,'tools')
                    visit(p,base,'/')
                    if width<700:
                        p.locator('#solutions').evaluate("e=>e.scrollIntoView({block:'start'})")
                        p.evaluate('scrollBy(0,120)')
                        sticky=p.locator('a[href="#contact"]').filter(has_text='Запросить консультацию').last
                        expect(sticky).to_be_visible();capture(p,'sticky-consultation')
                        sticky.click();expect(p.locator('#contact')).to_be_in_viewport();await_event(p,'cta_click',location='sticky')
                        expect(sticky).not_to_be_visible()
                    checked('Hero calculator, tools catalogue and mobile sticky consultation',width)
                c.close();print(f'{phase.upper()} browser {width}: completed',flush=True)
            browser.close()
        if phase=='after':
            assert not report['javascriptErrors'] and report['externalRequests']==0
            assert all(r['scroll']<=r['width'] and not r['overflow'] for r in report['layout']),'Layout overflow: see checks.json'
            assert not any(r['violations'] for r in report['axe']),'Accessibility violations: see checks.json'
            report['passed']=True
        else:report['captureCompleted']=True
finally:
    OUT.joinpath('checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
