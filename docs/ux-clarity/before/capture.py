from pathlib import Path
import os, json, subprocess

ROOT = Path(os.environ.get("QA_ROOT", Path(__file__).resolve().parents[3]))
BASE = 'a53537b1ad26ab7764f2c0299998b008ba76dec9'
head = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
clean = subprocess.run(['git','diff','--quiet',BASE,'--','app','components','config','content','lib','public','package.json','package-lock.json'],cwd=ROOT).returncode == 0
if head != BASE or not clean:
    raise SystemExit('BEFORE capture requires a clean build of '+BASE+'; set QA_ROOT to that baseline worktree')
OUT = ROOT / 'docs/ux-clarity/before'
OUT.mkdir(parents=True, exist_ok=True)
# Reuse only local-server/metadata/axe helpers, not the historical assertions.
source = (ROOT / 'scripts/check-repositioning.py').read_text().split('\ntry:\n    # Route 404')[0]
source = source.replace('ROOT = Path(__file__).resolve().parents[1]', f"ROOT = Path({str(ROOT)!r})")
source = source.replace('OUT = ROOT / "docs/repositioning/qa"', 'OUT = ROOT / "docs/ux-clarity/before"')
exec(source)
report['assessment'] = 'Expert walkthrough; no study participants or conversion measurement'
report['homeSections'] = []
report['journeys'] = []
with server() as base, sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    report['browserVersion'] = browser.version
    for width in [320,375,768,1024,1440]:
        c = browser.new_context(viewport={'width':width,'height':812 if width<600 else 1000}, reduced_motion='reduce')
        p = c.new_page()
        p.route('**/*', lambda r: r.continue_() if r.request.url.startswith(base+'/') else r.abort())
        visit(p,base,'/'); capture(p,'home'); axe(p,'home')
        sections = p.locator('main > section').evaluate_all('(xs)=>xs.map(e=>({id:e.id,height:Math.round(e.getBoundingClientRect().height)}))')
        report['homeSections'].append({'width':width,'height':p.evaluate('document.documentElement.scrollHeight'),'sections':sections})
        for selector,name in [('#solutions','services'),('#projects','cases'),('#cto','cto'),('#other-services','other-services')]:
            loc=p.locator(selector)
            if not loc.count(): continue
            if name=='other-services': loc.locator('summary').click()
            loc.evaluate("e=>e.scrollIntoView({block:'start'})"); capture(p,name); axe(p,name)
        for role,slug in [('owner','management-analytics'),('hr','corporate-academy')]:
            visit(p,base,'/')
            p.locator('#solutions').get_by_role('link',name='Подробнее',exact=False).filter(has_text='Подробнее').count()
            p.locator('#solutions a[href="/solutions/'+slug+'"]').click(); p.wait_for_url('**/solutions/'+slug)
            capture(p,role+'-offer')
            p.locator('#hero').get_by_role('link',name='Обсудить проект',exact=True).click()
            expect(p.locator('#contact')).to_be_in_viewport()
            report['journeys'].append({'width':width,'role':role,'clicksToForm':2,'route':['/', '/solutions/'+slug, '#contact']})
        visit(p,base,'/')
        # Existing employee entry is in the footer, via products catalogue.
        p.locator('footer a[href="/products"]').first.click(); p.wait_for_url('**/products')
        p.locator('main a[href="/products/ai-career"]').first.click(); p.wait_for_url('**/products/ai-career')
        capture(p,'ai-career'); axe(p,'ai-career')
        report['journeys'].append({'width':width,'role':'employee','clicksToProduct':2,'route':['footer /products','/products/ai-career'],'ambiguity':'No employee entry in Hero; old risk-oriented title and 947 RUB'})
        visit(p,base,'/')
        p.locator('main a[href="/services/cto"]').first.click(); p.wait_for_url('**/services/cto')
        capture(p,'cto-offer'); axe(p,'cto-offer')
        report['journeys'].append({'width':width,'role':'cto','clicksToOffer':1,'comparisonOnHome':False})
        if width in [375,1440]:
            visit(p,base,'/'); p.screenshot(path=str(SHOTS/f'{width}-home-full.png'),full_page=True)
        c.close()
        print(f'BEFORE {width}: captured',flush=True)
    browser.close()
OUT.joinpath('checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
