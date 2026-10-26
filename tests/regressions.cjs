const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8');
function fn(name) {
  const start = source.search(new RegExp(`  (?:async )?function ${name}\\(`));
  const end = source.indexOf('\n  }', start) + 4;
  return source.slice(start, end);
}
test('Only the latest financial request can render, including stale failures', async () => {
  const pending = [];
  const element = () => ({ textContent: '', hidden: false, replaceChildren() {} });
  const context = vm.createContext({
    financeRequest: 0, plannerId: 'p', sharedMode: false, financeMonth: '2026-01', monthlySalary: null, monthlyExpenses: [],
    els: { financeMessage: element(), financeSetup: element(), financeEmpty: element(), financeExpenseList: element() },
    monthBounds: month => ({ start: month + '-01', end: month + '-31' }),
    renderFinance() {}, renderBills() {}, loadBills: async () => {}, loadFinanceOptions: async () => {},
    supabase: { from(table) {
      let month;
      const q = { select(){return q}, eq(key,value){if(key==='month_start')month=value;return q}, gte(key,value){month=value;return q}, lt(){return q}, order(){return q}, maybeSingle(){return q}, range(){return q},
        then(resolve) { return new Promise(r => pending.push({table,month,resolve:r})).then(resolve); } }; return q;
    } }
  });
  vm.runInContext(fn('readExpenseRows'), context);
  vm.runInContext(fn('loadFinanceData'), context);
  const first = context.loadFinanceData(); await Promise.resolve();
  context.financeMonth = '2026-02';
  const second = context.loadFinanceData(); await Promise.resolve();
  for (const item of pending.filter(item=>item.month==='2026-02-01')) item.resolve({data:item.table==='planner_monthly_budgets'?{salary:200}:[]});
  await second;
  for (const item of pending.filter(item=>item.month==='2026-01-01')) item.resolve(item.table==='planner_monthly_budgets'?{error:{code:'42501'}}:{data:[]});
  await first;
  assert.equal(context.monthlySalary,200);
  assert.equal(context.els.financeMessage.textContent,'');
});
test('Errors use French messages without leaking server text', () => {
  const context = vm.createContext({}); vm.runInContext(fn('errorMessage'),context);
  assert.equal(context.errorMessage({code:'invalid_credentials'},'Erreur'),'Adresse e-mail ou mot de passe incorrect.');
  assert.equal(context.errorMessage({message:'private SQL details'},'Erreur française'),'Erreur française');
});
test('Salary writes include an ISO update timestamp', async () => {
  let payload;
  const button = {};
  const context = vm.createContext({financeMonth:'2026-01',plannerId:'p',
    els:{financeSalary:{value:'1500'},financeSalaryForm:{querySelector:()=>button},financeMessage:{}},
    supabase:{from:()=>({upsert:async value=>{payload=value;return {error:null}}})},loadFinanceData:async()=>{},errorMessage:()=>''});
  vm.runInContext(fn('saveMonthlySalary'),context);
  await context.saveMonthlySalary({preventDefault(){}});
  assert.equal(payload.salary,1500); assert.ok(Number.isFinite(Date.parse(payload.updated_at)));
  assert.equal(button.disabled,false);
});
test('Cloud save does not cache activities and legacy imports are disabled', () => {
  assert.ok(!fn('handleSubmit').includes('localStorage.setItem'));
  assert.match(source,/const localEvents = \[\]/);
  assert.ok(source.includes('events = [];') && source.includes('clearLegacyCache(); showAuth();'));
});

test('Monthly due dates handle short months and leap years', () => {
  const context = vm.createContext({}); vm.runInContext(fn('billDueDate'),context);
  assert.equal(context.billDueDate('2026-02',31),'2026-02-28');
  assert.equal(context.billDueDate('2028-02',31),'2028-02-29');
  assert.equal(context.billDueDate('2026-04',31),'2026-04-30');
  assert.equal(context.billDueDate('2026-10',3),'2026-10-03');
});
test('Bill confirmation writes the occurrence only once per action with its reference', async () => {
  let payload;
  const context=vm.createContext({billsReady:true,financeOptionsReady:false,paidBillIds:new Set(),plannerId:'p',
    changeBill:async(button,action)=>action(),supabase:{from:()=>({insert:async value=>{payload=value; return {error:null}}})}});
  vm.runInContext(fn('addBillExpense'),context);
  await context.addBillExpense({id:'b',label:'Electricité',amount:45},'2026-10-03',{});
  assert.equal(payload.recurring_bill_id,'b'); assert.equal(payload.expense_date,'2026-10-03');
  payload=null; context.paidBillIds.add('b');
  await context.addBillExpense({id:'b'},'2026-10-03',{}); assert.equal(payload,null);
});
test('Bill fields reset after successful writes and remain intact after errors', async () => {
  for (const error of [null, {code:'42501'}, {code:'23505'}]) {
    let resets=0;
    const context=vm.createContext({financeMonth:'2026-10',plannerId:'p',document:{querySelector:()=>({textContent:''})},
      loadFinanceData:async()=>{},errorMessage:()=> 'Erreur'});
    vm.runInContext(fn('changeBill'),context);
    const button={};
    await context.changeBill(button,async()=>({error}),'Enregistrée',()=>{resets++});
    assert.equal(resets,error ? 0 : 1);
    assert.equal(button.disabled,false);
  }
});

test('Activity end defaults to two hours later, capped at the end of the day', () => {
  const context=vm.createContext({}); vm.runInContext(fn('timeAfterStart'),context);
  assert.equal(context.timeAfterStart('09:00',120),'11:00');
  assert.equal(context.timeAfterStart('15:45',120),'17:45');
  assert.equal(context.timeAfterStart('22:30',120),'23:59');
  assert.equal(context.timeAfterStart('23:58',1),'23:59');
  assert.equal(context.timeAfterStart('',120),'');
});
test('Overlap detection excludes the same event, adjacent times and cancelled activities', () => {
  const context=vm.createContext({});vm.runInContext(fn('findOverlaps'),context);
  const record={id:'a',date:'2026-10-26',start:'09:00',end:'11:00'};
  const others=[{...record},{...record,id:'b',start:'10:30',end:'12:00'}, {...record,id:'c',start:'11:00',end:'12:00'}, {...record,id:'d',cancelled:true}, {...record,id:'e',date:'2026-10-27'}];
  assert.equal(context.findOverlaps(record,others).length,1);
  assert.equal(context.findOverlaps({...record,cancelled:true},others).length,0);
});
test('Week-copy identifiers are stable and scoped to planner and target date', async () => {
  const context=vm.createContext({crypto:require('node:crypto').webcrypto,TextEncoder});vm.runInContext(fn('copyActivityId'),context);
  const id=await context.copyActivityId('source','2026-10-26','p');
  assert.equal(id,await context.copyActivityId('source','2026-10-26','p'));
  assert.notEqual(id,await context.copyActivityId('source','2026-10-27','p'));
  assert.notEqual(id,await context.copyActivityId('source','2026-10-26','other'));
  assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
test('A week containing any activity is not empty, including cancelled activities', () => {
  const context=vm.createContext({dateKey:d=>d.toISOString().slice(0,10),addDays:(d,n)=>new Date(d.getTime()+n*86400000)});
  vm.runInContext(fn('weekHasActivities'),context);
  const monday=new Date('2026-10-26T00:00:00Z');
  assert.equal(context.weekHasActivities(monday,[]),false);
  assert.equal(context.weekHasActivities(monday,[{date:'2026-10-27',cancelled:true}]),true);
  assert.equal(context.weekHasActivities(monday,[{date:'2026-11-01',completed:true}]),true);
  assert.equal(context.weekHasActivities(monday,[{date:'2026-10-25'},{date:'2026-11-02'}]),false);
});
