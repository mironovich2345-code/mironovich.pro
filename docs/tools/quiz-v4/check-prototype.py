from playwright.sync_api import sync_playwright
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, HTTPServer
from threading import Thread
import os, shutil
import json,re
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
 def do_GET(self):
  path=self.path.split('?')[0]
  if path=='/docs/tools/quiz-v4/prototype.html' or path.startswith('/assets/blog-covers/fonts/') and path.endswith('.woff2'):return super().do_GET()
  self.send_error(404)
 def log_message(self,*args):pass
server=HTTPServer(('127.0.0.1',0),Handler)
Thread(target=server.serve_forever,daemon=True).start()
URL=f'http://127.0.0.1:{server.server_port}/docs/tools/quiz-v4/prototype.html'
AXE=Path(os.environ.get('AXE_PATH',str(ROOT/'node_modules/axe-core/axe.min.js')))
report={'cases':[],'javascriptErrors':[],'outboundPosts':[],'axe':[]}
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),args=['--no-sandbox'])
 for width in [1440,375]:
  p=b.new_page(viewport={'width':width,'height':1000 if width>900 else 812},reduced_motion='reduce',locale='ru-RU')
  p.on('pageerror',lambda e:report['javascriptErrors'].append(str(e)))
  p.on('request',lambda r:report['outboundPosts'].append(r.url) if r.method=='POST' else None)
  p.goto(URL);p.evaluate('()=>document.fonts.ready')
  def axe(label):
   if not AXE.is_file():return
   p.add_script_tag(path=str(AXE))
   result=p.evaluate('async()=>{const r=await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))}')
   report['axe'].append({'screen':label,'width':width,'violations':result})
   assert not result,(label,result)
  def fit():assert p.evaluate('innerWidth===document.documentElement.scrollWidth')
  def shot(name,full=False):
   fit();
   if full or name.endswith('first'):p.evaluate('window.scrollTo(0,0)')
   p.screenshot(path=str(OUT/f'{name}-{width}.png'),full_page=full)
  def click(action,value=None):p.locator('[data-action="'+action+'"]'+('' if value is None else '[data-value="'+value+'"]')).first.click()
  assert p.locator('#amount').input_value()==''
  if width==375:
   click('next');assert p.locator('#error').is_visible();assert p.locator('#progress').inner_text().startswith('Шаг 1')
  p.locator('#process-picker summary').click();click('task','reporting');p.locator('#process-picker summary').click()
  if width==375:shot('labor-mobile-first')
  p.locator('#employees').fill('3')
  if width==375:click('next')
  p.locator('#exact-repeat').fill('20');p.locator('#exact-duration').fill('3')
  if width==375:
   assert '3 ч ручной работы за смену' in p.locator('#intermediate').inner_text()
   shot('labor-mobile-work');axe('labor-mobile-work')
   click('next')
  click('schedule','5/2');p.locator('#actual').check();p.locator('#actual-shifts').fill('22');p.locator('#exact-shiftHours').fill('8')
  if width==375:shot('labor-mobile-graph');click('next')
  click('pay-kind','employer');p.locator('#amount').fill('105600')
  def metric(key,n):assert re.sub(r'\D','',p.locator('[data-metric="'+key+'"]').inner_text())==str(n)
  metric('monthly',39600);metric('hours',66);metric('annual',475200)
  if width==1440:
   assert p.locator('#mobile-nav').is_hidden();assert p.locator('#result').evaluate('e=>getComputedStyle(e).position')=='sticky'
   shot('labor-desktop',True);axe('labor-desktop')
   p.evaluate('window.scrollTo(0,0)');y=p.locator('#result').bounding_box()['y'];p.evaluate('window.scrollTo(0,200)');p.wait_for_timeout(100);assert p.locator('#result').bounding_box()['y']<=y
   p.locator('#exact-repeat').fill('10');metric('hours',33);metric('monthly',19800);p.locator('#exact-repeat').fill('20');p.evaluate('window.scrollTo(0,0)')
  else:
   assert '39\xa0600 ₽ / месяц' in p.locator('#intermediate').inner_text();shot('labor-mobile-pay');click('next');assert p.locator('#result').is_visible();shot('labor-mobile-result',True);axe('labor-mobile-result')
  click('improve');assert 'Перенесён расчёт' in p.locator('#form-content').inner_text()
  click('issue','time');assert p.locator('[data-phase=process]').is_hidden() and p.locator('[data-phase=frequency]').is_hidden()
  if width==1440:click('effect','financial');shot('automation-transfer',True)
  else:
   assert 'Шаг 1 из 2' in p.locator('#progress').inner_text();click('next');click('effect','financial');click('next');shot('automation-transfer-result',True)
  p.goto(URL+'?mode=auto')
  assert p.locator('#amount').count()==0
  click('issue','errors')
  if width==375:shot('automation-mobile-first');axe('automation-mobile-first');click('next')
  p.locator('#process-picker summary').click();click('task','reporting');p.locator('#process-picker summary').click()
  if width==375:click('next')
  click('issue-frequency','often')
  if width==375:click('next')
  click('effect','client')
  if width==1440:shot('automation-desktop',True);axe('automation-desktop')
  else:click('next');shot('automation-mobile-result',True);axe('automation-mobile-result')
  report['cases'].append({'width':width,'manualControlExample':True,'noSalaryDefault':True,'liveCalculation':True,'separateUnits':True,'knownTransferNoRepeat':True,'automationDirectEntry':True,'noHorizontalOverflow':True})
  p.close()
 p=b.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce',locale='ru-RU')
 p.on('pageerror',lambda e:report['javascriptErrors'].append(str(e)))
 p.on('request',lambda r:report['outboundPosts'].append(r.url) if r.method=='POST' else None)
 p.goto(URL)
 p.locator('#process-picker summary').click();p.locator('[data-action=task][data-value=reporting]').click();p.locator('#process-picker summary').click()
 p.locator('#employees').fill('3');p.locator('#exact-repeat').fill('20');p.locator('#exact-duration').fill('3')
 for schedule,expected in [('5/2',21),('6/1',25),('2/2',15),('3/3',15),('3/2',18)]:
  p.locator('[data-action=schedule][data-value="'+schedule+'"]').click()
  assert p.evaluate('graph(L).shifts')==expected,(schedule,expected)
 p.locator('[data-action=schedule][data-value="2/2"]').click();assert '14–16' in p.locator('#graph-note').inner_text()
 p.locator('[data-action=schedule][data-value=other]').click();p.locator('#actual-shifts').fill('22');p.locator('#exact-shiftHours').fill('8');p.locator('[data-action=pay-kind][data-value=employer]').click();p.locator('#amount').fill('105600')
 assert p.evaluate('calc().cost')==39600
 p.locator('#range-repeat').focus();p.keyboard.press('ArrowRight');assert p.locator('#exact-repeat').input_value()=='21';assert p.evaluate('calc().cost')==41580
 p.keyboard.press('ArrowLeft');assert p.evaluate('calc().cost')==39600
 p.locator('[data-action=period][data-value=week]').click();assert p.evaluate('calc().cost')==7714.29
 p.locator('[data-action=period][data-value=month]').click();assert p.evaluate('calc().cost')==1800
 p.locator('[data-action=period][data-value=shift]').click();p.locator('[data-action=unit][data-value=hours]').click();assert p.evaluate('calc().cost')==39600
 p.locator('[data-action=unit][data-value=minutes]').click();assert p.locator('#exact-duration').input_value()=='3'
 p.locator('[data-action=pay-kind][data-value=unknown]').click();assert p.evaluate('calc().cost') is None and p.evaluate('calc().hours')==66
 p.locator('[data-action=pay-kind][data-value=salary]').click();assert p.locator('#amount').input_value()=='';p.locator('#amount').fill('105600');assert 'не полные расходы' in p.locator('.caution').inner_text()
 p.locator('[data-action=plus]').click();assert p.locator('#employees').input_value()=='4';p.locator('[data-action=minus]').click();assert p.locator('#employees').input_value()=='3'
 p.locator('[data-action=preset][data-model=employees][data-value="10"]').click();assert p.locator('#employees').input_value()=='10';p.locator('#employees').fill('3.5');assert p.evaluate('calc().cost') is None;p.locator('#employees').fill('3')
 p.locator('#process-picker summary').click();p.locator('[data-action=task][data-value=transfer]').click();p.locator('#process-picker summary').click();assert 'Общий итог без подтверждения' in p.locator('#result').inner_text()
 p.locator('[data-action=active-task][data-value=transfer]').click();p.locator('#exact-repeat').fill('2');p.locator('#exact-duration').fill('5');assert p.evaluate('calc().hours')==11
 assert p.evaluate('calc(L,"reporting").hours')==66
 for viewport in [320,375,768,1024,1440]:
  p.set_viewport_size({'width':viewport,'height':900});assert p.evaluate('innerWidth===document.documentElement.scrollWidth')
 p.set_viewport_size({'width':375,'height':812});p.locator('[data-action=next]').click();p.locator('[data-action=back]').click();assert p.locator('#employees').input_value()=='3'
 report['additionalChecks']=['all six schedules','approximate cycle range vs actual shifts','hourly rate without early rounding','week/month/shift units','slider ArrowRight/ArrowLeft and exact input','minutes/hours conversion','unknown salary clears amount','salary vs employer cost distinction','employee +/- and presets','fractional employees rejected','multiple processes remain separate','mobile back preserves answers','overflow at 320/375/768/1024/1440']
 p.close()
 assert not report['javascriptErrors'] and not report['outboundPosts'],report
 report['browser']=b.version
 b.close()
 server.shutdown()
OUT.joinpath('prototype-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print('Responsive prototype checks PASS')
