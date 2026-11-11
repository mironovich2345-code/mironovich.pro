from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os
BASE=os.environ.get('TEST_BASE_URL','http://127.0.0.1:3032')
OUT=Path(__file__).resolve().parent;r={'cases':[],'errors':[],'axe':[]}
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for w in [320,375,768,1024,1440]:
  p=b.new_page(viewport={'width':w,'height':900 if w>=1024 else 812},reduced_motion='reduce',locale='ru-RU');p.on('pageerror',lambda e:r['errors'].append(str(e)))
  for path in ['/products','/products/ai-career','/products/automation-priorities']:
   p.goto(BASE+path);p.evaluate('()=>document.fonts.ready')
   assert p.locator('h1').count()==1
   assert p.locator('link[rel=canonical]').get_attribute('href')=='https://mironovich.pro'+path
   assert p.evaluate('innerWidth===document.documentElement.scrollWidth'),(w,path)
   assert p.get_by_role('button',name='Купить',exact=True).count()==0
   assert 'Готовится' in p.locator('main').inner_text()
   assert p.locator('main img').evaluate_all('imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)')
   if w in [375,1440]:
    p.screenshot(path=str(OUT/'screenshots'/f'{path.rsplit("/",1)[1]}-{w}.png'),full_page=True)
    p.add_script_tag(path=os.environ['AXE_PATH']);v=p.evaluate('async()=> (await axe.run(document.querySelector("main"),{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}})).violations.map(v=>v.id)');r['axe'].append({'path':path,'width':w,'violations':v});assert not v,v
   r['cases'].append({'path':path,'width':w,'overflow':False})
  p.close()
 p=b.new_page(viewport={'width':375,'height':812});p.goto(BASE+'/');p.get_by_role('button',name='Меню',exact=True).click();p.locator('#mobile-menu').get_by_role('link',name='Продукты',exact=True).click();p.wait_for_url('**/products');assert p.url.endswith('/products')
 sitemap=p.request.get(BASE+'/sitemap.xml').text()
 for slug in ['products','products/ai-career','products/automation-priorities']:assert 'https://mironovich.pro/'+slug in sitemap
 assert p.request.get(BASE+'/products/unknown').status==404
 b.close()
assert not r['errors'];OUT.joinpath('browser-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print('PASS 15 page/viewport cases, navigation, metadata, sitemap, Axe, 404')
