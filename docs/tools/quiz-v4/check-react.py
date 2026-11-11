"""Real production-build browser checks; synthetic local data, no external delivery.
Run after npm run build and start with the guarded test-only Telegram preload.
TEST_BASE_URL=http://127.0.0.1:3040 AXE_PATH=/path/to/axe.min.js python check-react.py
"""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
from urllib.parse import urlsplit
import json
import os

BASE = os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:3040')
assert urlsplit(BASE).hostname in ['localhost', '127.0.0.1'] and urlsplit(BASE).scheme == 'http', 'Local synthetic preview only'
OUT = Path(__file__).resolve().parent / 'simplified-2026-11-12'
OUT.mkdir(exist_ok=True)
REPORT = {'widths': [], 'jsErrors': [], 'assetErrors': [], 'axe': [], 'scenarios': [], 'earlyLeadPosts': 0, 'unexpectedAiRequests': [], 'fullPageAxe': []}


def next_step(p):
    p.get_by_role('button', name='Далее', exact=True).click()


def metric(p, key):
    return p.locator(f'[data-metric={key}]').inner_text().replace('\u00a0', '').replace('\u202f', '').replace(' ', '')


def geometry(p):
    assert p.evaluate('innerWidth === document.documentElement.scrollWidth'), 'Horizontal page overflow'
    overlapping = p.evaluate('''() => [...document.querySelectorAll('.qw-field > span')].filter(s => {
      if(s.getBoundingClientRect().width <= 1) return false;
      const i=s.parentElement.querySelector('input'), r=s.getBoundingClientRect();
      return i && r.bottom > i.getBoundingClientRect().top + 1;
    }).map(s => s.textContent)''')
    assert not overlapping, overlapping


def shot(p, width, tool, state):
    geometry(p)
    if width not in [375, 1440] and state != 'result':
        return
    p.evaluate('scrollTo(0,0)')
    p.screenshot(path=str(OUT / f'{tool}-{width}-{state}.png'))


def axe(p, width, tool, state):
    if not p.evaluate('() => typeof window.axe !== "undefined"'):
        p.add_script_tag(path=os.environ['AXE_PATH'])
    violations = p.evaluate('''async () => (await axe.run(document.querySelector('.qw'), {
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}
    })).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))''')
    REPORT['axe'].append({'width': width, 'tool': tool, 'state': state, 'violations': violations})
    assert not violations, violations
    if width in [375, 1440] and state == 'result':
        full = p.evaluate('''async () => (await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))''')
        REPORT['fullPageAxe'].append({'width':width,'tool':tool,'violations':full})
        assert not full, full


def ready(p, tool, clear=False):
    if clear:
        p.evaluate('sessionStorage.clear()')
    p.goto(BASE + '/tools/' + tool)
    p.locator('[data-workspace=simplified-v4]').wait_for()
    p.wait_for_timeout(160)  # hydrate matchMedia and optional same-tab restoration


def control(p, mobile, width, check_reload=True):
    assert p.locator('#qw-task').input_value() == 'reporting'
    shot(p, width, 'labor', 'first')
    axe(p, width, 'labor', 'first')
    if mobile:
        next_step(p)
    expect(p.locator('#qw-employees')).to_have_value('4')
    p.get_by_role('button', name='На одного больше', exact=True).click()
    expect(p.locator('#qw-employees')).to_have_value('5')
    p.get_by_role('button', name='На одного меньше', exact=True).click()
    expect(p.locator('#qw-employees')).to_have_value('4')
    if mobile:
        next_step(p)
        next_step(p)
        expect(p.locator('.qw-step-footer [role=alert]')).to_contain_text('Укажите число повторений')
    p.locator('#qw-repeat').fill('20')
    slider = p.get_by_role('slider', name='Повторения — ползунок')
    slider.focus(); p.keyboard.press('ArrowRight')
    expect(p.locator('#qw-repeat')).to_have_value('21')
    p.keyboard.press('ArrowLeft')
    expect(p.locator('#qw-repeat')).to_have_value('20')
    if mobile:
        assert p.locator('.qw-intermediate strong').inner_text() == '80'
        next_step(p)
    p.get_by_role('button', name='5 мин', exact=True).click()
    shot(p, width, 'labor', 'intermediate')
    if mobile:
        expect(p.locator('.qw-progress span')).to_have_text('4 из 7')
        p.get_by_role('button', name='Предыдущий вопрос').click()
        expect(p.locator('#qw-repeat')).to_have_value('20')
        p.go_back()
        expect(p.locator('.qw-duration-value')).to_contain_text('5')
        next_step(p)
    p.get_by_role('button', name='2/2', exact=True).click()
    details = p.locator('.qw-editor details').first
    details.locator('summary').click()
    p.locator('#qw-month').fill('2026-11')
    details.locator('summary').click()
    if mobile:
        expect(p.locator('.qw-progress span')).to_have_text('5 из 7')
        next_step(p)
    else:
        expect(p.locator('.qw-missing')).to_contain_text('продолжительность смены')
        p.get_by_role('button', name='Указать параметр →').click()
        expect(p.locator('#qw-hours')).to_be_focused()
        assert metric(p, 'hours') == '100ч'
    p.locator('#qw-hours').fill('8')
    if mobile:
        next_step(p)
    p.locator('#qw-amount').fill('120000')
    if mobile:
        next_step(p)
    assert metric(p, 'monthly') == '100000₽/мес.'
    assert metric(p, 'hours') == '100ч'
    assert metric(p, 'annual') == '1200000₽'
    geometry(p)
    shot(p, width, 'labor', 'result')
    axe(p, width, 'labor', 'result')
    if check_reload:
        p.reload(); p.wait_for_timeout(180)
        assert metric(p, 'monthly') == '100000₽/мес.'
        assert metric(p, 'hours') == '100ч'


def desktop_edits(p):
    p.locator('#qw-amount').fill('120 000')
    expect(p.locator('#qw-amount')).to_have_value('120000')
    assert metric(p, 'monthly') == '100000₽/мес.'
    p.locator('#qw-amount').fill('60000')
    assert metric(p, 'monthly') == '50000₽/мес.'
    p.locator('#qw-amount').fill('120000')
    p.get_by_role('button', name='На одного больше', exact=True).click()
    assert metric(p, 'monthly') == '125000₽/мес.'
    p.get_by_role('button', name='На одного меньше', exact=True).click()
    for schedule, expected in [('5/2', '140ч'), ('2/2', '100ч'), ('3/3', '100ч'), ('6/1', '166,67ч'), ('3/2', '120ч')]:
        p.get_by_role('button', name=schedule, exact=True).click()
        assert metric(p, 'hours') == expected
        assert metric(p, 'monthly') == '100000₽/мес.'
    p.get_by_role('button', name='Другой', exact=True).click()
    expect(p.locator('#qw-shifts')).to_be_visible()
    p.locator('#qw-shifts').fill('15')
    assert metric(p, 'monthly') == '100000₽/мес.'
    p.get_by_role('button', name='2/2', exact=True).click()
    p.get_by_role('button', name='За неделю', exact=True).click()
    assert metric(p, 'hours') == '28,57ч'
    assert metric(p, 'monthly') == '28571,43₽/мес.'
    p.get_by_role('button', name='За месяц', exact=True).click()
    assert metric(p, 'hours') == '6,67ч'
    assert metric(p, 'monthly') == '6666,67₽/мес.'
    p.get_by_role('button', name='За смену', exact=True).click()
    p.get_by_role('button', name='Другое', exact=True).click()
    p.locator('#qw-duration').fill('0.08333333333333333')
    p.get_by_label('Единицы времени').select_option('hours')
    # Unit changes convert the existing quantity rather than reinterpret it.
    p.locator('#qw-duration').fill('0.08333333333333333')
    assert metric(p, 'monthly') == '100000₽/мес.'
    p.get_by_role('button', name='5 мин', exact=True).click()
    p.get_by_role('button', name='+ Добавить ещё задачу', exact=True).click()
    assert p.locator('#qw-task').input_value() == 'transfer'
    p.locator('#qw-task').select_option('reporting')
    assert metric(p, 'monthly') == '100000₽/мес.'
    assert p.locator('.qw-other-results').is_visible()
    p.reload(); p.wait_for_timeout(180)
    assert p.locator('#qw-task').input_value() == 'reporting'
    assert metric(p, 'monthly') == '100000₽/мес.'
    p.locator('#qw-task').select_option('transfer')
    p.locator('#qw-repeat').fill('10')
    p.get_by_role('button', name='3 мин', exact=True).click()
    assert metric(p, 'monthly') == '30000₽/мес.'
    p.locator('#qw-task').select_option('reporting')
    assert metric(p, 'monthly') == '100000₽/мес.'
    p.get_by_role('button', name='Не знаю зарплату', exact=True).click()
    assert metric(p, 'monthly') == '—₽/мес.'
    assert metric(p, 'hours') == '100ч'
    p.get_by_role('button', name='Указать сумму', exact=True).click()
    p.locator('#qw-amount').fill('120000')
    details = p.locator('.qw-editor details').first
    details.locator('summary').click()
    p.get_by_label('Что входит в месячную сумму').select_option('employer')
    expect(p.locator('.qw-caution')).to_contain_text('По полным расходам')
    p.get_by_label('Указать фактические смены').check()
    p.locator('#qw-shifts').fill('14')
    assert metric(p, 'hours') == '93,33ч'
    assert metric(p, 'monthly') == '100000₽/мес.'
    p.get_by_label('Указать фактические смены').uncheck()
    details.locator('summary').click()
    p.locator('#qw-repeat').fill('100001')
    expect(p.locator('.qw-missing [role=alert]')).to_contain_text('100 000')
    assert metric(p, 'monthly') == '—₽/мес.'
    p.locator('#qw-repeat').fill('20')
    assert metric(p, 'monthly') == '100000₽/мес.'
    geometry(p)


def automation(p, mobile, width, transferred=False):
    if transferred:
        expect(p.get_by_text('Данные расчёта уже учтены.')).to_be_visible()
        assert not p.locator('#qw-task').count()
        p.get_by_role('button', name='Много времени уходит на рутину', exact=True).click()
        if mobile: next_step(p)
        assert not p.get_by_role('button', name='Почти каждый день', exact=True).count()
    else:
        shot(p, width, 'automation', 'first')
        axe(p, width, 'automation', 'first')
        p.get_by_role('button', name='Ошибки и исправления', exact=True).click()
        if mobile: next_step(p)
        p.locator('#qw-task').select_option('reporting')
        if mobile: next_step(p)
        p.get_by_role('button', name='Почти каждый день', exact=True).click()
        shot(p, width, 'automation', 'intermediate')
        if mobile: next_step(p)
    p.get_by_role('button', name='Клиенты ждут ответа', exact=True).click()
    if mobile: next_step(p)
    expect(p.locator('.qw-auto-title')).to_have_text('Что стоит проверить в первую очередь')
    expect(p.get_by_role('button', name='Обсудить автоматизацию', exact=True)).to_be_visible()
    assert p.locator('[data-metric=monthly]').count() == 0
    geometry(p)
    if not transferred:
        shot(p, width, 'automation', 'result')
        axe(p, width, 'automation', 'result')


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width in [320, 375, 768, 1024, 1440]:
        p = browser.new_page(viewport={'width': width, 'height': 1000 if width > 900 else 812}, reduced_motion='reduce', locale='ru-RU')
        posts = []
        p.on('pageerror', lambda e: REPORT['jsErrors'].append(str(e)))
        p.on('response', lambda r: REPORT['assetErrors'].append(r.url) if r.status >= 400 and '/_next/' in r.url else None)
        p.on('request', lambda r: REPORT['unexpectedAiRequests'].append(r.url) if 'api.openai.com' in r.url or '/api/tools/recommend' in r.url else None)
        p.on('request', lambda r: posts.append(r.post_data_json) if r.method == 'POST' and '/api/lead' in r.url else None)
        ready(p, 'labor-cost')
        control(p, width <= 900, width)
        if width > 900: desktop_edits(p)
        assert not posts
        p.locator('.qw-result > details').filter(has=p.get_by_text('Есть ли готовые решения?', exact=True)).locator('summary').click()
        p.get_by_role('link', name='Проверить возможности улучшения →').click()
        p.locator('.qw').wait_for(); p.wait_for_timeout(160)
        automation(p, width <= 900, width, transferred=True)
        assert not posts
        ready(p, 'automation-cost', clear=True)
        automation(p, width <= 900, width)
        assert not posts
        if width == 375:
            ready(p, 'automation-cost', clear=True)
            p.get_by_role('button', name='Пока трудно определить', exact=True).click()
            expect(p.locator('.qw-progress span')).to_have_text('1 из 2')
            next_step(p)
            p.locator('#qw-task').select_option('reporting')
            next_step(p)
            expect(p.locator('.qw-statuses')).to_contain_text('Нужны данные')
            expect(p.get_by_role('button', name='Обсудить автоматизацию', exact=True)).to_be_visible()
        REPORT['widths'].append({'width': width, 'labor': 'pass', 'automation': 'pass', 'transfer': 'pass', 'geometry': 'pass', 'sameTabReload': 'pass'})
        p.close()
    REPORT['analytics'] = []
    for consent in ['denied', 'granted']:
        p = browser.new_page(viewport={'width': 375, 'height': 812}, reduced_motion='reduce')
        p.add_init_script(f"localStorage.setItem('mrnv_analytics_consent_v1','{consent}')")
        ready(p, 'labor-cost')
        control(p, True, 375, check_reload=False)
        p.get_by_role('button', name='Обсудить автоматизацию', exact=True).click()
        events = p.evaluate("() => (window.mrnvEvents || []).filter(e => e.event.startsWith('tool_'))")
        if consent == 'denied': assert not events
        else:
            names = {e['event'] for e in events}
            assert {'tool_start', 'tool_step', 'tool_complete', 'tool_consultation'} <= names
            assert all(set(e) <= {'event', 'location', 'tool', 'step', 'page'} for e in events)
            assert '120000' not in json.dumps(events)
        REPORT['analytics'].append({'consent': consent, 'toolEventCount': len(events), 'noAnswersOrFinancialValues': True})
        p.close()
    browser.close()
REPORT['scenarios'] = ['live salary / employees / schedule / periods', 'unknown salary', 'duration hour conversion', 'unfinished second task retains selected money', 'separate multiple tasks without total', 'actual shifts / employer cost', 'validation and missing-field focus', 'mobile next / back / browser back', 'reload restores values and selected task', 'imported parameters skip repeated questions', 'no lead or OpenAI request before consent and submission']
assert not REPORT['jsErrors'], REPORT['jsErrors']
assert not REPORT['assetErrors'], REPORT['assetErrors']
assert not REPORT['unexpectedAiRequests'], REPORT['unexpectedAiRequests']
for png in OUT.glob('*.png'):
    # Verify real browser capture dimensions match their filenames.
    assert int.from_bytes(png.read_bytes()[16:20], 'big') == int(png.name.split('-')[1]), png.name
(OUT / 'browser-report.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=2) + '\n')
print('PASS: both calculators at five widths, real interactions, no early lead POST, Axe', len(REPORT['axe']), 'checks')
