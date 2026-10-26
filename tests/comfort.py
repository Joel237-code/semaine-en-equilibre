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
const activities=[],goals=[],listeners=[];
const now=new Date(), monday=new Date(now);monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
function key(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
const old=new Date(monday);old.setDate(old.getDate()-7);
activities.push({id:'a',planner_id:'p',title:'École lecture',category:'school',activity_date:key(now),start_time:'09:00',end_time:'11:00',cancelled:false,completed:false}, {id:'old',planner_id:'p',title:'École ancienne',category:'school',activity_date:key(old),start_time:'09:00',end_time:'11:00',cancelled:false,completed:true});
window.remoteInsert=()=>{activities.push({id:'remote',planner_id:'p',title:'Activité distante',category:'sport',activity_date:key(now),start_time:'14:00',end_time:'15:00'});for(const l of listeners)if(l.table==='activities'&&l.event==='INSERT')l.cb()};
window.remoteDelete=()=>{activities.splice(activities.findIndex(a=>a.id==='remote'),1);for(const l of listeners)if(l.table==='activities'&&l.event==='DELETE')l.cb()};
export function createClient(){return {
channel(){const channel={on(type,filter,cb){listeners.push({...filter,cb});return channel},subscribe(cb){setTimeout(()=>cb('SUBSCRIBED'),10);return channel}};return channel},removeChannel(){listeners.length=0;return Promise.resolve()},
auth:{getSession:async()=>({data:{session:{user:{id:'u'}}}}),onAuthStateChange(cb){window.fakeSignOut=()=>cb('SIGNED_OUT',null)}},from(table){let mode='read',values;const q={
select(){return q},eq(){return q},limit(){return q},order(){return q},range(){return q},gte(){return q},lt(){return q},maybeSingle(){return q},
upsert(v){mode='upsert';values=v;return q},then(resolve){let data=[];
if(table==='planner_members')data=[{planner_id:'p',role:'member'}];
if(table==='activities'){if(mode==='upsert')for(const v of(Array.isArray(values)?values:[values])){const i=activities.findIndex(a=>a.id===v.id);if(i>=0)activities[i]=v;else activities.push(v)}data=activities;}
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
  try:
   page.wait_for_function("document.querySelectorAll('#week-grid .event-card').length===1",timeout=15000)
  except Exception:
   print('ERRORS',errors,'SETUP',page.locator('#setup-message').inner_text(),'BODY',page.locator('body').inner_text()[:500]);raise
  page.locator('#theme-toggle').click()
  assert page.locator('html').get_attribute('data-theme')=='dark'
  page.reload(wait_until='networkidle')
  assert page.locator('html').get_attribute('data-theme')=='dark'
  page.locator('#activity-search').fill('ecole')
  page.wait_for_function("document.querySelectorAll('#search-results .event-card').length===2")
  page.locator('#activity-search').fill('')
  page.locator('#week-grid .event-card').first.click()
  page.locator('#duplicate-event').click()
  next_date=page.evaluate("(()=>{const d=new Date();d.setDate(d.getDate()+1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()")
  page.locator('#event-date').fill(next_date)
  page.locator('#save-event').click()
  page.wait_for_function("document.querySelectorAll('#week-grid .event-card').length===2")
  page.locator('#open-form').click();page.locator('#event-title').fill('Test conflit');page.locator('#event-start').fill('09:30')
  assert page.locator('#activity-overlap').is_visible()
  page.locator('#close-form').click()
  page.set_viewport_size({'width':1440,'height':900})
  # Native desktop drag has the date form as its touch/keyboard alternative.
  page.locator('#week-grid .event-card').first.drag_to(page.locator('.day-column').nth(6))
  page.wait_for_function("document.querySelectorAll('.day-column')[6].querySelector('.event-card')!==null")
  page.evaluate('window.remoteInsert()')
  page.wait_for_function("document.querySelector('#week-grid').textContent.includes('Activité distante')")
  page.evaluate('window.remoteDelete()')
  page.wait_for_function("!document.querySelector('#week-grid').textContent.includes('Activité distante')")
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  page.evaluate('window.fakeSignOut()')
  assert page.locator('#auth-panel').is_visible()
  assert page.locator('#week-grid .event-card').count()==0
  assert not errors,errors
  print('PASS: dark mode persistence, accent-insensitive all-week search, duplicate, overlap warning, drag move, remote insert/delete refresh')
  b.close()
finally: server.shutdown()
