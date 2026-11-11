"""Browser proof for both visual directions; only local prototype assets are served."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, HTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
import json
import os
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SHOTS = HERE / 'screenshots'
AXE = Path(os.environ.get('AXE_PATH', str(ROOT/'node_modules/axe-core/axe.min.js')))
report = {'browserCases': [], 'axe': [], 'javascriptErrors': [], 'postRequests': [], 'externalRequests': []}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = self.path.split('?')[0]
        if path.startswith('/docs/tools/quiz-v4/directions/') or path == '/docs/tools/quiz-v4/prototype.html' or path.startswith('/assets/blog-covers/fonts/') and path.endswith('.woff2'):
            return super().do_GET()
        self.send_error(404)

    def log_message(self, *args):
        pass


original = (HERE.parent/'prototype.html').read_text().split('<script>', 1)[1].split('const cards=', 1)[0]
assert (HERE/'calculation-core.js').read_text().split('\n', 1)[1] == original
report['calculationSourceUnchanged'] = True
server = HTTPServer(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}'
PREFIX = BASE + '/docs/tools/quiz-v4/directions/'


def observe(page):
    page.on('pageerror', lambda e: report['javascriptErrors'].append(str(e)))
    page.on('request', lambda r: report['postRequests'].append(r.url) if r.method == 'POST' else None)
    page.on('request', lambda r: report['externalRequests'].append(r.url) if not r.url.startswith(BASE) else None)


def action(page, name, value=None):
    selector = f'[data-action="{name}"]' + (f'[data-value="{value}"]' if value is not None else '')
    page.locator(selector).filter(visible=True).first.click()


def row(page, key):
    toggle = page.locator(f'[data-action=row][data-value="{key}"]')
    if toggle.get_attribute('aria-expanded') != 'true':
        toggle.click()


def fit(page):
    assert page.evaluate('innerWidth === document.documentElement.scrollWidth'), page.viewport_size


def screenshot(page, variant, tool, viewport, stage):
    fit(page)
    page.evaluate('()=>{document.activeElement?.blur();window.scrollTo(0,0)}')
    page.mouse.move(0,0)
    name = f'{variant}-{tool}-{viewport}-{stage}-{page.viewport_size["width"]}.png'
    page.screenshot(path=str(SHOTS/name))
    if AXE.is_file():
        page.add_script_tag(path=str(AXE))
        violations = page.evaluate('''async () => (await axe.run(document, {runOnly: {type:'tag', values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v => ({id:v.id, impact:v.impact, nodes:v.nodes.map(n=>n.target)}))''')
        report['axe'].append({'screenshot': name, 'violations': violations})
        assert not violations, (name, violations)


def count_question(page):
    assert page.locator('.parameter-row:visible').count() == 1
    assert page.locator('.question-title:visible').count() == 1


def control_example(page):
    assert page.evaluate('calc().hours') == 66
    assert page.evaluate('calc().cost') == 39600
    assert page.evaluate('calc().annual') == 475200


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'), args=['--no-sandbox'])
    report['browser'] = browser.version
    for variant, filename in [('a', 'minimal-dark.html'), ('b', 'light-workspace.html')]:
        for width, viewport in [(1440, 'desktop'), (375, 'mobile')]:
            page = browser.new_page(viewport={'width': width, 'height': 900 if width == 1440 else 812}, reduced_motion='reduce', locale='ru-RU')
            observe(page)
            url = PREFIX + filename
            page.goto(url)
            page.evaluate('()=>document.fonts.ready')
            assert page.evaluate('L.amount') == ''
            if viewport == 'desktop':
                assert page.locator('[data-action=row]').count() == 5
                assert page.locator('.row-body:visible').count() == 0
                assert page.locator('#result').is_visible()
            else:
                count_question(page)
            screenshot(page, variant, 'labor', viewport, 'first')
            if viewport == 'mobile':
                action(page, 'next')
                assert page.locator('#step-error').is_visible()
            if viewport == 'desktop':
                row(page, 'process')
            action(page, 'task', 'reporting')
            if viewport == 'mobile':
                assert page.locator('#progress').inner_text() == '1 из 7'
                action(page, 'next')
                count_question(page)
            else:
                row(page, 'employees')
            page.locator('#employees').fill('3')
            action(page, 'plus')
            assert page.locator('#employees').input_value() == '4'
            action(page, 'minus')
            if viewport == 'mobile':
                action(page, 'next')
            else:
                row(page, 'frequency')
            page.locator('#repeat').fill('20')
            page.locator('#repeat-range').focus()
            page.keyboard.press('ArrowRight')
            assert page.locator('#repeat').input_value() == '21'
            page.keyboard.press('ArrowLeft')
            if viewport == 'mobile':
                assert '60 операций за смену' in page.locator('#intermediate').inner_text()
                screenshot(page, variant, 'labor', viewport, 'middle')
                action(page, 'back')
                assert page.locator('#employees').input_value() == '3'
                action(page, 'next')
                assert page.locator('#repeat').input_value() == '20'
                action(page, 'next')
            else:
                row(page, 'duration')
            assert page.locator('input[type=range]:visible').count() == 0
            action(page, 'minutes', '3')
            if viewport == 'mobile':
                assert '3 ч ручной работы за смену' in page.locator('#intermediate').inner_text()
                action(page, 'next')
            else:
                row(page, 'graphCost')
            action(page, 'schedule', '5/2')
            page.locator('#exact-schedule summary').click()
            page.locator('#actual').check()
            page.locator('#shifts').fill('22')
            if viewport == 'mobile':
                assert '66 ч ручной работы в месяц' in page.locator('#intermediate').inner_text()
                action(page, 'next')
            page.locator('#shiftHours').fill('8')
            if viewport == 'desktop':
                row(page, 'frequency')
                assert page.evaluate('calc().hours') == 66
                assert page.evaluate('calc().cost') is None
                screenshot(page, variant, 'labor', viewport, 'middle')
                row(page, 'graphCost')
            else:
                assert '176 рабочих часов' in page.locator('#intermediate').inner_text()
                action(page, 'next')
            page.locator('#pay-kind').select_option('employer')
            page.locator('#amount').fill('105600')
            control_example(page)
            if viewport == 'mobile':
                action(page, 'next')
                assert page.locator('#result').is_visible()
            else:
                action(page, 'row', 'graphCost')
            screenshot(page, variant, 'labor', viewport, 'result')
            assert page.locator('.cta').bounding_box()['y'] + page.locator('.cta').bounding_box()['height'] <= page.viewport_size['height'], ('CTA below first result screen', variant, viewport)
            assert page.locator('#why-details').get_attribute('open') is None
            page.locator('#why-details summary').click()
            assert 'совместимость ещё не проверены' in page.locator('#why-details').inner_text()
            page.locator('#why-details summary').click()
            action(page, 'improve')
            assert page.locator('#transfer').is_visible()
            if viewport == 'desktop':
                row(page, 'issue')
            action(page, 'issue', 'time')
            assert len(page.evaluate('phases()')) == 2
            if viewport == 'mobile':
                assert page.locator('#progress').inner_text() == '1 из 2'
                action(page, 'next')
            else:
                row(page, 'effect')
            action(page, 'effect', 'time')
            if viewport == 'mobile':
                action(page, 'next')
            assert '39' in page.locator('[data-metric=monthly]').inner_text()
            assert page.locator('#employees').count() == 0
            if viewport == 'mobile':
                action(page,'edit')
            else:
                row(page,'issue')
            action(page,'issue','unclear')
            assert len(page.evaluate('phases()')) == 1
            if viewport == 'mobile':
                assert page.locator('#progress').inner_text() == '1 из 1'
                action(page,'next')

            # Fresh automation entry; no invented numbers and no repeated labor form.
            page.goto(url+'?mode=auto')
            page.evaluate('()=>document.fonts.ready')
            screenshot(page, variant, 'automation', viewport, 'first')
            if viewport == 'desktop':
                row(page, 'issue')
            else:
                count_question(page)
            action(page, 'issue', 'errors')
            if viewport == 'mobile':
                action(page, 'next')
            else:
                row(page, 'process')
            action(page, 'task', 'reporting')
            if viewport == 'mobile':
                action(page, 'next')
            else:
                row(page, 'problemFrequency')
            action(page, 'problem-frequency', 'often')
            screenshot(page, variant, 'automation', viewport, 'middle')
            if viewport == 'mobile':
                action(page, 'next')
            else:
                row(page, 'effect')
            action(page, 'effect', 'client')
            if viewport == 'mobile':
                action(page, 'next')
            else:
                action(page, 'row', 'effect')
            screenshot(page, variant, 'automation', viewport, 'result')
            assert page.locator('[data-metric=monthly]').count() == 0
            assert page.locator('.cta').bounding_box()['y'] + page.locator('.cta').bounding_box()['height'] <= page.viewport_size['height']
            action(page, 'consult')
            assert page.locator('#consult-message').is_visible()
            report['browserCases'].append({'variant': variant, 'viewport': viewport, 'width': width, 'laborCompleted': True, 'automationCompleted': True, 'transferWithoutRepeatedInputs': True, 'ctaInFirstResultViewport': True})
            page.close()

    # Compare the preserved model with the original across units, schedules and pay kinds.
    old = browser.new_page()
    old.goto(BASE+'/docs/tools/quiz-v4/prototype.html')
    page = browser.new_page(viewport={'width':1440,'height':900})
    observe(page)
    page.goto(PREFIX+'minimal-dark.html')
    cases = []
    for schedule in ['5/2','2/2','3/3','6/1','3/2','other']:
        for period in ['shift','week','month']:
            for pay in ['salary','employer','unknown']:
                cases.append({'tasks':['reporting'], 'active':'reporting','employees':'3','month':'2026-11','schedule':schedule,'actual':schedule=='other','shifts':'22','shiftHours':'8','payKind':pay,'amount':'' if pay=='unknown' else '105600','measures':{'reporting':{'repeat':'20','period':period,'duration':'3','unit':'minutes'}}})
    evaluate = '(data)=>calc(data,"reporting")'
    for data in cases:
        assert old.evaluate(evaluate,data) == page.evaluate(evaluate,data)
    report['originalModelParityCases'] = len(cases)
    for schedule,expected in [('5/2',21),('2/2',15),('3/3',15),('6/1',25),('3/2',18)]:
        assert page.evaluate('(s)=>graph({...L,schedule:s}).shifts',schedule) == expected
    assert '14–16' in page.evaluate('graph({...L,schedule:"2/2"}).note')
    # Unknown salary, custom hours, multiple independent processes and invalid input.
    row(page, 'process');action(page, 'task', 'reporting');action(page, 'task', 'transfer')
    row(page, 'employees');page.locator('#employees').fill('3.5')
    assert page.locator('#employees').get_attribute('aria-invalid') == 'true'
    assert page.locator('.amount-warning').is_visible()
    page.locator('#employees').fill('3')
    row(page, 'frequency');page.locator('#repeat').fill('20')
    action(page,'active-task','transfer');page.locator('#repeat').fill('2')
    row(page,'duration');action(page,'minutes','5')
    action(page,'active-task','reporting');action(page,'custom-duration')
    page.locator('#duration').fill('3');page.locator('#duration-unit').select_option('hours')
    assert page.locator('#duration').input_value() == '0.05'
    row(page,'graphCost');action(page,'schedule','other');page.locator('#shifts').fill('22');page.locator('#shiftHours').fill('8')
    page.locator('#pay-kind').select_option('employer');page.locator('#amount').fill('105600')
    control_example(page)
    assert page.evaluate('calc(L,"transfer").hours') == 11
    assert 'без проверки пересечений' in page.locator('.multi-note').inner_text()
    page.locator('#pay-kind').select_option('unknown')
    assert page.evaluate('L.amount') == '' and page.evaluate('calc().cost') is None and page.evaluate('calc().hours') == 66
    page.locator('#pay-kind').select_option('salary');page.locator('#amount').fill('105600')
    assert 'По зарплате' in page.locator('.result-subtitle').inner_text()
    page.locator('#shifts').fill('32');assert page.locator('#shifts').get_attribute('aria-invalid') == 'true'
    page.locator('#shifts').fill('22')
    page.locator('#month').fill('');assert 'Укажите корректный месяц' in page.locator('.amount-warning').inner_text()
    page.locator('#month').fill('2026-11')
    row(page,'process');action(page,'task','reporting');action(page,'task','transfer')
    assert page.locator('[data-metric=monthly]').inner_text() == '— ₽'
    assert page.locator('[data-metric=hours]').inner_text() == '— ч'
    for filename in ['minimal-dark.html','light-workspace.html']:
        for mode in ['labor','auto']:
            page.goto(PREFIX+filename+('?mode=auto' if mode=='auto' else ''))
            for width in [320,375,768,1024,1440]:
                page.set_viewport_size({'width':width,'height':812 if width<901 else 900});fit(page)
                if width<901:count_question(page)
    page.set_viewport_size({'width':375,'height':812});page.goto(PREFIX+'minimal-dark.html')
    action(page,'task','reporting');action(page,'task','transfer');assert page.locator('#progress').inner_text() == '1 из 9'
    page.locator('#tool-mode').select_option('auto');action(page,'issue','unclear');assert page.locator('#progress').inner_text() == '1 из 2';action(page,'next');action(page,'task','reporting');action(page,'next')
    assert page.locator('#result').is_visible()
    report['additionalChecks'] = ['all six schedules', 'actual vs cycle range', 'week/month/shift units', 'salary vs employer cost', 'unknown salary clears amount', 'minutes/hours conversion', 'multiple processes without totals', 'fractional employees rejected', 'invalid actual shift count and month visible', 'removing all processes clears displayed totals', 'slider keyboard and exact input', 'counter +/-', 'back preserves answers', 'conditional progress 7/9 and 4/2/1', 'both themes and tools: 320/375/768/1024/1440 overflow', 'no requests before or after consultation CTA']
    page.close();old.close()
    report['standaloneExports'] = []
    with TemporaryDirectory(prefix='mironovich-v4-prototype-') as directory:
        subprocess.run([sys.executable, str(HERE/'export-directions.py'), directory], check=True, capture_output=True, text=True)
        for file in sorted(Path(directory).glob('*.html')):
            assert file.read_bytes() == (HERE/'standalone'/file.name).read_bytes(), 'Regenerate the checked-in offline HTML deliverables'
            page = browser.new_page(viewport={'width':375,'height':812}, reduced_motion='reduce')
            observe(page)
            page.set_content(file.read_text())
            page.evaluate('()=>document.fonts.ready')
            assert page.evaluate('L.amount') == ''
            action(page,'task','reporting');action(page,'next')
            page.locator('#employees').fill('3');action(page,'next')
            page.locator('#repeat').fill('20');action(page,'next')
            action(page,'minutes','3');action(page,'next')
            action(page,'schedule','other');page.locator('#shifts').fill('22');action(page,'next')
            page.locator('#shiftHours').fill('8');action(page,'next')
            page.locator('#pay-kind').select_option('employer');page.locator('#amount').fill('105600')
            control_example(page);action(page,'next');action(page,'improve')
            action(page,'issue','unclear');assert page.locator('#progress').inner_text() == '1 из 1'
            action(page,'next');assert '39' in page.locator('[data-metric=monthly]').inner_text()
            report['standaloneExports'].append({'file':file.name,'laborAndTransferFlowPassed':True,'offline':True})
            page.close()
    assert not report['javascriptErrors'] and not report['postRequests'] and not report['externalRequests'], report
    browser.close()
server.shutdown()
(HERE/'checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PASS: 24 screenshots, both directions and tools, preserved model, keyboard and responsive checks.')
