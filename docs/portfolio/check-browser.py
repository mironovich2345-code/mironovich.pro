from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os
BASE=os.environ.get('TEST_BASE_URL','http://127.0.0.1:3037')
OUT=Path(__file__).resolve().parent;r={'cases':[],'axe':[],'errors':[]}
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [320,375,768,1024,1440]:
  p=b.new_page(viewport={'width':width,'height':900 if width>900 else 812},reduced_motion='reduce',locale='ru-RU');p.on('pageerror',lambda e:r['errors'].append(str(e)))
  for path in ['/','/projects','/projects/eatlyy','/projects/club-ops']:
   p.goto(BASE+path);p.evaluate('()=>document.fonts.ready');assert p.evaluate('innerWidth===document.documentElement.scrollWidth'),(width,path)
   for image in p.locator('main img').all():image.scroll_into_view_if_needed()
   p.wait_for_function('()=>Array.from(document.querySelectorAll("main img")).every(i=>i.complete&&i.naturalWidth>0)')
   p.evaluate('window.scrollTo(0,0)')
   html=p.locator('main').inner_text()
   assert 'Корпоративная платформа обучения для сети фитнес-клубов' not in html
   if path=='/':assert p.locator('#projects article').count()==2
   else:
    assert p.locator('link[rel=canonical]').get_attribute('href')=='https://mironovich.pro'+path
    assert p.locator('main img').evaluate_all('a=>a.every(i=>i.complete&&i.naturalWidth>0)')
   if width in [375,1440]:
    if path=='/':p.locator('#projects').scroll_into_view_if_needed();p.locator('#projects').screenshot(path=str(OUT/'screenshots'/f'home-cases-{width}.png'))
    else:
     p.screenshot(path=str(OUT/'screenshots'/f'{path.rsplit("/",1)[1]}-{width}.png'),full_page=True)
     p.add_script_tag(path=os.environ['AXE_PATH']);v=p.evaluate('async()=> (await axe.run(document.querySelector("main"),{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}})).violations.map(v=>v.id)');r['axe'].append({'width':width,'path':path,'violations':v});assert not v,(path,v)
   r['cases'].append({'width':width,'path':path,'overflow':False})
  p.close()
 p=b.new_page();sitemap=p.request.get(BASE+'/sitemap.xml').text();assert '/projects/eatlyy' in sitemap and '/projects/club-ops' in sitemap and 'corporate-learning' not in sitemap
 for slug in ['corporate-learning','unapproved-case']:assert p.request.get(BASE+'/projects/'+slug).status==404
 b.close()
assert not r['errors'];OUT.joinpath('browser-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print('PASS 20 cases, published routes, corporate 404/noindex exclusion, images, Axe, no overflow/JS errors')
