"""Consented local requests through the real API; guarded synthetic Telegram delivery.
429 and 503 responses are intercepted in the browser to exercise form feedback.
No payloads, names or contacts are written into the report.
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
results = []

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for mode in ['labor-cost', 'automation-cost']:
        for status in [200, 429, 503]:
            p = browser.new_page(viewport={'width': 375, 'height': 812}, reduced_motion='reduce')
            posts = []
            p.on('request', lambda r: posts.append(r.post_data_json) if r.method == 'POST' and '/api/lead' in r.url else None)
            p.goto(BASE + '/tools/' + mode)
            p.locator('.qw').wait_for(); p.wait_for_timeout(160)
            def next_step(): p.get_by_role('button', name='Далее', exact=True).click()
            if mode == 'labor-cost':
                next_step(); next_step()
                p.locator('#qw-repeat').fill('20'); next_step()
                p.get_by_role('button', name='5 мин', exact=True).click(); next_step()
                p.get_by_role('button', name='2/2', exact=True).click()
                p.locator('.qw-editor summary').click(); p.locator('#qw-month').fill('2026-11'); next_step()
                p.locator('#qw-hours').fill('8'); next_step()
                p.locator('#qw-amount').fill('120000'); next_step()
            else:
                p.get_by_role('button', name='Ошибки и исправления', exact=True).click(); next_step()
                p.locator('#qw-task').select_option('reporting'); next_step()
                p.get_by_role('button', name='Почти каждый день', exact=True).click(); next_step()
                p.get_by_role('button', name='Клиенты ждут ответа', exact=True).click(); next_step()
            assert not posts
            p.get_by_role('button', name='Обсудить автоматизацию', exact=True).click()
            assert not posts
            p.locator('#lead-name').fill('Тестовый посетитель')
            p.locator('#lead-phone').fill('@qa_synthetic')
            p.locator('#lead-task').fill('Синтетическая проверка заявки без данных клиентов.')
            p.locator('#qw-contact button[type=submit]').click()
            expect(p.get_by_text('Нужно согласие на обработку данных', exact=True)).to_be_visible()
            assert not posts
            if status == 200:
                p.add_script_tag(path=os.environ['AXE_PATH'])
                violations = p.evaluate('''async () => (await axe.run(document.querySelector('.qw-contact'), {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>v.id)''')
                assert not violations, violations
            p.locator('#lead-consent').focus(); p.keyboard.press('Space')
            expect(p.locator('#lead-consent')).to_be_checked()
            if status != 200:
                p.route('**/api/lead', lambda route, request, code=status: route.fulfill(status=code, json={'ok': False}))
            p.locator('#qw-contact button[type=submit]').click()
            if status == 200:
                p.get_by_text('Заявка отправлена.', exact=True).wait_for()
                delivery = json.loads(Path(os.environ.get('TOOLS_V3_STUB_REPORT', '/tmp/tools-v3-delivery.json')).read_text())
                assert delivery['serverRecalculated'] is True
                if mode == 'labor-cost':
                    assert delivery['has100000'] and delivery['has1200000']
            elif status == 429: p.get_by_text('Слишком много попыток', exact=False).wait_for()
            else: p.get_by_text('Не получилось доставить заявку', exact=False).wait_for()
            assert len(posts) == 1 and posts[0]['consent'] is True
            context = posts[0]['toolContext']
            assert context['version'] == 'tools-quiz-4.0.0'
            assert context['input']['kind'] == ('labor' if mode == 'labor-cost' else 'diagnosis')
            assert 'qa_synthetic' not in json.dumps(context)
            results.append({'tool': mode, 'status': status, 'noEarlyPost': True, 'consentRequired': True, 'oneConsentedPost': True, 'contextKind': context['input']['kind'], 'clientFeedback': 'pass', 'openFormAxeViolations': [] if status == 200 else None, 'realApiWithSyntheticDelivery': status == 200})
            p.close()
    browser.close()
(OUT / 'form-browser-report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
print('PASS: both lead forms, consent, keyboard, success / 429 / delivery failure; no early requests')
