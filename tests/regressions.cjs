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
    renderFinance() {},
    supabase: { from() {
      const q = { select(){return q}, eq(){return q}, gte(){return q}, lt(){return q}, order(){return q}, maybeSingle(){return q},
        then(resolve) { return new Promise(r => pending.push(r)).then(resolve); } }; return q;
    } }
  });
  vm.runInContext(fn('loadFinanceData'), context);
  const first = context.loadFinanceData(); await Promise.resolve();
  context.financeMonth = '2026-02';
  const second = context.loadFinanceData(); await Promise.resolve();
  pending[2]({data:{salary:200}}); pending[3]({data:[]}); await second;
  pending[0]({error:{code:'42501'}}); pending[1]({data:[]}); await first;
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
  assert.match(source,/events = \[\];\s*monthlySalary = null; monthlyExpenses = \[\]; clearLegacyCache\(\)/);
});
