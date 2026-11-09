"""Export two offline, single-file HTML prototypes with unchanged licensed fonts."""
from pathlib import Path
import base64
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
target = Path(sys.argv[1]) if len(sys.argv) == 2 else None
if target is None:
    raise SystemExit('Usage: python export-directions.py OUTPUT_DIRECTORY')
target.mkdir(parents=True, exist_ok=True)
css = (HERE/'refined.css').read_text()
for font in (ROOT/'assets/blog-covers/fonts').glob('*.woff2'):
    css = css.replace('../../../../assets/blog-covers/fonts/'+font.name,
                      'data:font/woff2;base64,'+base64.b64encode(font.read_bytes()).decode())
assert '../../../../assets/' not in css
license_text = '\n\n'.join((ROOT/'assets/blog-covers/fonts'/name).read_text()
                           for name in ['Inter-LICENSE.txt', 'RobotoCondensed-LICENSE.txt'])
scripts = '\n'.join((HERE/name).read_text() for name in ['calculation-core.js', 'refined.js'])
for source, output in [('minimal-dark.html','MIRONOVICH-v4-A-Minimal-Dark.html'),
                       ('light-workspace.html','MIRONOVICH-v4-B-Light-Workspace.html')]:
    html = (HERE/source).read_text()
    html = html.replace('<link rel="stylesheet" href="refined.css">', '<style>'+css+'</style>')
    html = html.replace('<script src="calculation-core.js" defer></script><script src="refined.js" defer></script>', '')
    html = html.replace('</body>', '<script>'+scripts+'</script>\n<script type="text/plain" id="embedded-font-licenses">\n'+license_text+'\n</script></body>')
    (target/output).write_text(html)
    print(output)
