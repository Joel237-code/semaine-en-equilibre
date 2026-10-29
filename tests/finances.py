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
const month=new Date().toISOString().slice(0,7), previous=new Date(Number(month.slice(0,4)),Number(month.slice(5))-1,0).toISOString().slice(0,7);
const budgets={[month]:{salary:1000,carry_amount:40},[previous]:{salary:500,carry_amount:25}};
const expenses=[{id:'a',planner_id:'p',label:'Courses',amount:50,category:'groceries',expense_date:month+'-01'}, {id:'b',planner_id:'p',label:'Bus',amount:25,category:'transport',expense_date:month+'-02'}, {id:'c',planner_id:'p',label:'Ancien',amount:100,category:'other',expense_date:previous+'-01'}];
export function createClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:'u'}}}}),onAuthStateChange(){}},from(table){let mode='read',values,filters={},start,end;const q={
select(){return q},eq(k,v){filters[k]=v;return q},limit(){return q},order(){return q},range(){return q},gte(k,v){start=v;return q},lt(k,v){end=v;return q},maybeSingle(){return q},
update(v){mode='update';values=v;return q},upsert(v){mode='upsert';values=v;return q},then(resolve){let data=[];
if(table==='planner_members')data=[{planner_id:'p',role:'member'}];
if(table==='planner_monthly_budgets'){const m=(filters.month_start||values?.month_start||month).slice(0,7);if(mode==='upsert')budgets[m]={...budgets[m],...values};data=budgets[m]||null;}
if(table==='planner_expenses'){if(mode==='update')Object.assign(expenses.find(e=>e.id===filters.id),values);data=expenses.filter(e=>(!start||e.expense_date>=start)&&(!end||e.expense_date<end));}
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
  page.locator('.mobile-sections a[data-page=budget]').click()
  page.wait_for_function("document.querySelector('#expenses-total').textContent.includes('75')")
  page.locator('#expense-list .expense-edit').first.click()
  page.locator('#expense-amount').fill('80');page.select_option('#expense-category','donations')
  page.locator('#expense-form button[type=submit]').click()
  page.wait_for_function("document.querySelector('#expenses-total').textContent.includes('105')")
  assert 'Dons et offrandes' in page.locator('#expense-chart').inner_text()
  assert 'Dons et offrandes' in page.locator('#expense-list').inner_text()
  assert '80' in page.locator('#expense-chart').inner_text()
  assert page.locator('#carry-previous').count()==0
  assert '40' in page.locator('#carry-total').inner_text()
  assert '935' in page.locator('#money-left').inner_text()
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  assert not errors,errors
  print('PASS: edit expense, change category, monthly chart, no carry action, preserve existing carried balance')
  b.close()
finally: server.shutdown()
