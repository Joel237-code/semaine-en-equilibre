"""Mobile page navigation with simulated Supabase."""
import ast
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
root=Path(__file__).resolve().parents[1]
fixture=ast.parse((root/'tests/finances.py').read_text())
module=next(ast.literal_eval(stmt.value) for stmt in fixture.body if isinstance(stmt,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='module' for t in stmt.targets))
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':390,'height':844});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('https://cdn.jsdelivr.net/**',lambda r:r.fulfill(body=module,content_type='application/javascript'))
  page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  page.goto(f'http://127.0.0.1:{server.server_port}/?view=report',wait_until='networkidle')
  page.locator('.activity-report').wait_for()
  assert not page.locator('.planner').is_visible()
  assert not page.locator('.finance-panel').is_visible()
  assert page.locator('#activity-search').count()==0
  for width in [320,375,390,430]:
   page.set_viewport_size({'width':width,'height':844})
   if page.locator('html').get_attribute('data-theme')=='dark':page.locator('#theme-toggle').click()
   light=page.locator('.account-controls').evaluate("(e)=>[...e.children].map(c=>{const r=c.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})")
   page.locator('#theme-toggle').click()
   dark=page.locator('.account-controls').evaluate("(e)=>[...e.children].map(c=>{const r=c.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})")
   assert light==dark, (width,light,dark)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.set_viewport_size({'width':390,'height':844})
  assert page.locator('[data-page=report]').get_attribute('aria-current')=='page'
  page.locator('[data-page=budget]').click()
  assert page.locator('.finance-panel').is_visible()
  assert not page.locator('.activity-report').is_visible()
  page.locator('#expense-label').fill('Brouillon conservé')
  page.locator('[data-page=planning]').click()
  assert page.locator('.planner').is_visible()
  assert not page.locator('.finance-panel').is_visible()
  page.go_back()
  page.locator('.finance-panel').wait_for()
  assert page.locator('#expense-label').input_value()=='Brouillon conservé'
  assert 'view=budget' in page.url
  page.go_forward();page.locator('.planner').wait_for()
  page.locator('[data-page=report]').click()
  page.reload(wait_until='networkidle')
  page.locator('.activity-report').wait_for()
  assert not page.locator('.planner').is_visible()
  page.set_viewport_size({'width':844,'height':390})
  assert page.locator('.activity-report').is_visible() and not page.locator('.planner').is_visible()
  page.set_viewport_size({'width':1024,'height':900})
  assert page.locator('.planner').is_visible() and page.locator('.finance-panel').is_visible()
  page.locator('.filter-chip[data-filter=work]').click()
  page.set_viewport_size({'width':390,'height':844})
  page.wait_for_function("document.querySelector('.filter-chip[data-filter=all]').classList.contains('is-active')")
  assert page.locator('.activity-report').is_visible() and not page.locator('.planner').is_visible()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  print('PASS: separate mobile pages, direct link, draft preservation, Back/Forward, reload, desktop and resize')
  browser.close()
finally:server.shutdown()
