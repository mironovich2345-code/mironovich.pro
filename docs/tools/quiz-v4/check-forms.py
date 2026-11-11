from playwright.sync_api import sync_playwright
from pathlib import Path
import json,os
from urllib.parse import urlsplit
BASE=os.environ.get('TEST_BASE_URL','http://127.0.0.1:3039')
assert urlsplit(BASE).hostname in ['localhost','127.0.0.1'] and urlsplit(BASE).scheme=='http', 'Local synthetic preview only'
r=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for status in [200,429,503]:
  p=b.new_page(viewport={'width':375,'height':812},reduced_motion='reduce');posts=[];p.on('request',lambda x:posts.append(x.post_data_json) if x.method=='POST' and '/api/lead' in x.url else None)
  p.goto(BASE+'/tools/automation-cost');p.locator('.qw').wait_for();p.wait_for_timeout(200)
  def next():p.locator('.qw-nav .qw-cta').click()
  p.get_by_role('button',name='Ошибки и исправления',exact=True).click();next();p.locator('.qw-task-list button').filter(has_text='Отчёты').click();next();p.get_by_role('button',name='Почти каждый день',exact=True).click();next();p.get_by_role('button',name='Клиенты ждут ответа',exact=True).click();next()
  assert not posts;p.get_by_role('button',name='Разобрать процесс с экспертом',exact=True).click();assert not posts
  p.locator('#lead-name').fill('Тестовый посетитель');p.locator('#lead-phone').fill('@qa_synthetic');p.locator('#lead-task').fill('Тестовая заявка по автоматизации без персональных данных клиентов.');p.locator('input[type=checkbox][id*=consent]').check()
  if status!=200:p.route('**/api/lead',lambda route,request,s=status:route.fulfill(status=s,json={'ok':False}))
  p.locator('#qw-contact button[type=submit]').click()
  if status==200:p.get_by_text('Заявка отправлена.',exact=True).wait_for()
  elif status==429:p.get_by_text('Слишком много попыток',exact=False).wait_for()
  else:p.get_by_text('Не получилось доставить заявку',exact=False).wait_for()
  assert len(posts)==1 and posts[0]['consent'] is True and posts[0]['toolContext']['input']['kind']=='diagnosis'
  r.append({'status':status,'contextKind':'diagnosis','noEarlyPost':True,'oneConsentedPost':True,'clientStateCorrect':True,'realServerRecalculation':status==200});p.close()
 b.close()
(Path(__file__).resolve().parent/'form-browser-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print('PASS automation lead success / 429 / delivery failure; no early requests')
