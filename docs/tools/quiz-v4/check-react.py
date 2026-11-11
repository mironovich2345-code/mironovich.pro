from playwright.sync_api import sync_playwright
from pathlib import Path
import os
from urllib.parse import urlsplit
import json
BASE=os.environ.get('TEST_BASE_URL','http://127.0.0.1:3031')
assert urlsplit(BASE).hostname in ['localhost','127.0.0.1'] and urlsplit(BASE).scheme=='http', 'Local synthetic preview only'
OUT=Path(__file__).resolve().parent/'react-screenshots';report={'cases':[],'errors':[],'posts':0,'axe':[]}
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [320,375,768,1024,1440]:
  p=b.new_page(viewport={'width':width,'height':900 if width>900 else 812},reduced_motion='reduce',locale='ru-RU');p.on('pageerror',lambda e:report['errors'].append(str(e)))
  p.on('request',lambda r:report.update(posts=report['posts']+1) if r.method=='POST' and '/api/lead' in r.url else None)
  p.goto(BASE+'/tools/labor-cost');p.locator('.qw').wait_for();p.wait_for_timeout(200)
  # Optional consent banner is outside the calculator.
  for name in ['Только необходимые','Отклонить','Не принимать']:
   el=p.get_by_role('button',name=name,exact=True)
   if el.count() and el.is_visible():el.click()
  mobile=width<=900
  def row(key):
   if not mobile:p.locator('.qw-row').filter(has=p.locator('span')).all()
   t=p.locator('.qw-row[aria-controls="qw-body-'+key+'"]')
   if not mobile and t.get_attribute('aria-expanded')!='true':t.click()
  def next():p.locator('.qw-nav .qw-cta').click()
  if not mobile:row('processes')
  assert p.locator('.qw-result .qw-cta').count()==0
  p.locator('.qw-task-list button').filter(has_text='Отчёты').click()
  if mobile:next()
  else:row('employees')
  p.locator('#qw-employees').fill('3')
  if mobile:next()
  else:row('frequency')
  p.locator('#qw-repeat').fill('20');p.locator('input[type=range]').focus();p.keyboard.press('ArrowRight');assert p.locator('#qw-repeat').input_value()=='21';p.keyboard.press('ArrowLeft')
  if mobile:next()
  else:row('duration')
  p.get_by_role('button',name='3 мин',exact=True).click()
  if mobile:next()
  else:row('expenses')
  p.get_by_role('button',name='5/2',exact=True).click();p.locator('.qw-editor details summary').click();p.get_by_label('Указать фактические смены').check()
  if mobile:next()
  p.locator('#qw-shifts').fill('22')
  if mobile:next()
  p.locator('#qw-hours').fill('8')
  if mobile:next()
  p.get_by_label('Основание суммы').select_option('employer');p.locator('#qw-amount').fill('105600')
  if mobile:next()
  assert '39' in p.locator('[data-metric=monthly]').inner_text();assert p.locator('[data-metric=hours]').inner_text()=='66 ч';assert '475' in p.locator('[data-metric=annual]').inner_text()
  assert p.evaluate('innerWidth===document.documentElement.scrollWidth'),width
  p.locator('#calculator').scroll_into_view_if_needed();p.screenshot(path=str(OUT/f'labor-{width}.png'),full_page=False)
  p.add_script_tag(path=os.environ['AXE_PATH'])
  violations=p.evaluate('async()=> (await axe.run(document.querySelector(".qw"),{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))');report['axe'].append({'width':width,'violations':violations});assert not violations,violations
  if width==375:
   assert report['posts']==0
   p.get_by_role('button',name='Разобрать затраты с экспертом',exact=True).click();assert report['posts']==0
   p.locator('#lead-name').fill('Тестовый посетитель');p.locator('#lead-phone').fill('@test_example');p.locator('#lead-task').fill('Проверка заявки с синтетическими данными.');
   # Keep real API and server recalculation; only Telegram delivery is intercepted by test preload.
   p.locator('input[type=checkbox][id*=consent]').check()
   p.locator('#qw-contact button[type=submit]').click();p.get_by_text('Заявка отправлена.',exact=True).wait_for()
  p.get_by_role('link',name='Проверить возможности улучшения →').click();p.locator('.qw').wait_for();p.wait_for_timeout(150)
  if not mobile:row('obstacle')
  p.get_by_role('button',name='Много времени уходит на рутину',exact=True).click()
  if mobile:next()
  else:row('consequence')
  p.get_by_role('button',name='Отвлекает от основной работы',exact=True).click()
  if mobile:next()
  assert p.locator('[data-metric=hours]').inner_text()=='66 ч';assert p.evaluate('innerWidth===document.documentElement.scrollWidth')
  p.locator('#calculator').scroll_into_view_if_needed();p.screenshot(path=str(OUT/f'automation-{width}.png'))
  p.evaluate('sessionStorage.clear()');p.goto(BASE+'/tools/automation-cost');p.wait_for_timeout(150)
  if not mobile:row('obstacle')
  p.get_by_role('button',name='Ошибки и исправления',exact=True).click()
  if mobile:next()
  else:row('processes')
  p.locator('.qw-task-list button').filter(has_text='Отчёты').click()
  if mobile:next()
  else:row('issue_frequency')
  p.get_by_role('button',name='Почти каждый день',exact=True).click()
  if mobile:next()
  else:row('consequence')
  p.get_by_role('button',name='Клиенты ждут ответа',exact=True).click()
  if mobile:next()
  assert p.locator('.qw-result .qw-cta').count()==1
  assert p.locator('[data-metric=monthly]').count()==0
  assert p.evaluate('innerWidth===document.documentElement.scrollWidth')
  report['cases'].append({'width':width,'labor':True,'transfer':True});p.close()
 b.close()
assert not report['errors'],report['errors'];OUT.parent.joinpath('react-browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('PASS',report)
