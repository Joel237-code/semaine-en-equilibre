"""Browser flow with simulated Supabase; no real database access."""
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(Path(__file__).resolve().parents[1])))
Thread(target=server.serve_forever,daemon=True).start()
module='''
const activities=[],goals=[];
const now=new Date(), day=(now.getDay()+6)%7; now.setDate(now.getDate()-day-7);
const date=now.toISOString().slice(0,10);
activities.push({id:'11111111-1111-4111-8111-111111111111',planner_id:'p',title:'Sport hebdomadaire',category:'sport',activity_date:date,start_time:'09:00',end_time:'11:00',cancelled:false,completed:true});
export function createClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:'u'}}}}),onAuthStateChange(){}},from(table){let mode='read',values;const q={
select(){return q},eq(){return q},limit(){return q},order(){return q},range(){return q},gte(){return q},lt(){return q},maybeSingle(){return q},
upsert(v){mode='upsert';values=v;return q},then(resolve){let data=[];
if(table==='planner_members')data=[{planner_id:'p',role:'member'}];
if(table==='activities'){if(mode==='upsert')for(const v of (Array.isArray(values)?values:[values]))if(!activities.some(a=>a.id===v.id))activities.push(v);data=activities;}
if(table==='planner_weekly_goals'){if(mode==='upsert')goals.splice(0,goals.length,...values);data=goals;}
if(table==='planner_monthly_budgets')data=null;
return Promise.resolve({data,error:null}).then(resolve);}};return q;}}};
'''
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=b.new_page(viewport={'width':390,'height':844});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('https://cdn.jsdelivr.net/**',lambda r:r.fulfill(body=module,content_type='application/javascript'))
  page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
  page.locator('#copy-previous-week').click()
  page.wait_for_function("document.querySelectorAll('.event-card').length===1")
  assert 'is-completed' not in page.locator('.event-card').get_attribute('class')
  assert not page.locator('#copy-previous-week').is_visible()
  page.locator('#copy-previous-week').dispatch_event('click')
  page.wait_for_function("document.querySelector('#planning-message').textContent.includes('semaine vide')")
  assert page.locator('.event-card').count()==1
  assert page.locator('#goals-settings').count()==0
  assert not page.locator('.summary-row').is_visible()
  assert not page.locator('.filters').is_visible()
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  assert not errors,errors
  print('PASS: copy previous week, reset status, repeat without duplicates, no goals or category blocks on mobile')
  b.close()
finally: server.shutdown()
