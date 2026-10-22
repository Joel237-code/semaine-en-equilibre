"""Run with python3 tests/mobile.py (requires Playwright and Chromium)."""
import base64
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(Path(__file__).resolve().parents[1])))
Thread(target=server.serve_forever, daemon=True).start()
payload = {'version': 1, 'week': '2026-10-19', 'events': [
    {'id': 'test', 'title': 'Une longue activité pour vérifier la lisibilité sur téléphone',
     'category': 'school', 'date': '2026-10-19', 'start': '09:00', 'end': '10:00', 'completed': True}
]}
encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        for width, height in [(320, 568), (375, 667), (390, 844), (430, 932), (620, 800), (768, 1024), (1440, 900)]:
            page = browser.new_page(viewport={'width': width, 'height': height})
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(body='export function createClient(){return {}}', content_type='application/javascript'))
            page.route('https://fonts.googleapis.com/**', lambda r: r.abort())
            page.goto(f'http://127.0.0.1:{server.server_port}/#share={encoded}', wait_until='networkidle')
            # Expose finance layout without accessing a real account or database.
            page.evaluate("document.querySelector('#finance-panel').hidden=false")
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
            if width <= 620:
                assert page.locator('#report-cards').is_visible()
                assert page.locator('.report-card').count() == 7
                assert page.locator('.report-card dd').all_text_contents()[:4] == ['1', '0', '1', '100 %']
                assert not page.locator('.report-table-wrap').is_visible()
                assert page.evaluate("[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length).every(e=>e.getBoundingClientRect().height>=44)")
                page.locator('.mobile-sections a[href="#report-heading"]').click()
                assert page.locator('#report-heading').bounding_box()['y'] >= 60
            else:
                assert page.locator('.report-table-wrap').is_visible()
            page.locator('#open-form').click()
            assert page.locator('#event-dialog').is_visible()
            if width <= 620:
                assert page.locator('#event-dialog').bounding_box()['height'] <= height
                page.set_viewport_size({'width': width, 'height': 350})
                page.locator('#event-title').fill('Activité mobile')
                page.locator('#save-event').scroll_into_view_if_needed()
                box = page.locator('#save-event').bounding_box()
                assert box['y'] >= 0 and box['y'] + box['height'] <= 350
                assert page.locator('#event-title').evaluate('(e)=>getComputedStyle(e).fontSize') == '16px'
            page.locator('#close-form').click()
            assert not page.locator('#event-dialog').is_visible()
            assert not errors, errors
            page.close()
            print(f'PASS {width}x{height}: layout, report, controls and form')
        browser.close()
finally:
    server.shutdown()
