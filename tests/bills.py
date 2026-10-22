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
const bills=[], expenses=[];
export function createClient(){return {
 auth:{getSession:async()=>({data:{session:{user:{id:'user'}}}}),onAuthStateChange(){}},
 from(table){let mode='read',value,filters={}; const q={
 limit(){return q},select(){return q},eq(k,v){filters[k]=v;return q},gte(){return q},lt(){return q},order(){return q},range(){return q},maybeSingle(){return q},
 insert(v){mode='insert';value=v;return q},delete(){mode='delete';return q},update(v){mode='update';value=v;return q},
 then(resolve){let data=[];
 if(table==='planner_members')data=[{planner_id:'p',role:'member'}];
 if(table==='planner_monthly_budgets')data=null;
 if(table==='planner_recurring_bills'){
 if(mode==='insert')bills.push({...value,id:'bill-1',active:true});
 if(mode==='update')bills.find(b=>b.id===filters.id).active=false;
 data=bills.filter(b=>b.active);
 }
 if(table==='planner_expenses'){
 if(mode==='insert')expenses.push({...value,id:'expense-1'});
 if(mode==='delete')expenses.splice(expenses.findIndex(e=>e.id===filters.id),1);
 data=expenses;
 }
 return Promise.resolve({data,error:null}).then(resolve);
 }};return q;}
}};
'''
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=b.new_page(viewport={'width':390,'height':844});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('https://cdn.jsdelivr.net/**',lambda r:r.fulfill(body=module,content_type='application/javascript'))
  page.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
  page.locator('.bill-settings summary').click()
  page.locator('#bill-label').fill('Électricité');page.locator('#bill-amount').fill('45');page.locator('#bill-day').fill('1')
  page.locator('#bill-form button').click()
  suggestion=page.locator('#bill-suggestions .bill-row')
  suggestion.wait_for();assert 'Électricité' in suggestion.inner_text()
  for field in ['#bill-label','#bill-amount','#bill-day']:
   assert page.locator(field).input_value() == ''
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  suggestion.locator('button').click()
  page.wait_for_function("document.querySelector('#expenses-total').textContent.includes('45')")
  assert page.locator('#bill-suggestions .bill-row').count()==0
  assert 'Électricité' in page.locator('#expense-list').inner_text()
  page.on('dialog',lambda d:d.accept())
  page.locator('#expense-list button').click()
  suggestion.wait_for()
  page.locator('#bill-list button').click()
  page.wait_for_function("document.querySelector('#bill-list').children.length===0")
  assert page.locator('#bill-suggestions .bill-row').count()==0
  assert not errors,errors
  print('PASS mobile: create monthly bill, due suggestion, confirm expense, no duplicate suggestion, delete expense, stop bill; no remote writes')
  b.close()
finally: server.shutdown()
