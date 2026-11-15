"""Render the original typographic OG from local fonts, without external assets or services."""
from pathlib import Path
import base64
import os
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
html = (root / "docs/repositioning/og.html").read_text()
for placeholder, filename in [("__DISPLAY_FONT__", "RobotoCondensed-cyrillic.woff2"), ("__INTER_FONT__", "Inter-cyrillic.woff2")]:
    data = base64.b64encode((root / "assets/blog-covers/fonts" / filename).read_bytes()).decode()
    html = html.replace(placeholder, "data:font/woff2;base64," + data)
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), headless=True, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
    page.route("http**/*", lambda route: route.abort())
    page.set_content(html)
    page.evaluate("document.fonts.ready")
    page.screenshot(path=str(root / "public/og/business-solutions.png"))
    browser.close()
