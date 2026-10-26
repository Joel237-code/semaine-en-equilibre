import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

(async () => {
  "use strict";

  const STORAGE_KEY = "semaine-en-equilibre.events.v1";
  const supabase = createClient("https://vlmnyhuirtczgjrbnlxl.supabase.co", "sb_publishable_4BgM1XswECgt8rYElCyCcQ_yUvIEtHl");
  const categories = {
    school: { label: "École", className: "school" },
    work: { label: "Travail", className: "work" },
    spiritual: { label: "Activité spirituelle", className: "spiritual" },
    selfcare: { label: "Moment pour soi", className: "selfcare" },
    sport: { label: "Sport", className: "sport" },
    other: { label: "Autre activité", className: "other" }
  };
  const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  const els = {
    weekLabel: document.querySelector("#week-label"),
    grid: document.querySelector("#week-grid"),
    dialog: document.querySelector("#event-dialog"),
    pageShell: document.querySelector(".page-shell"),
    financePanel: document.querySelector("#finance-panel"),
    financeMonth: document.querySelector("#finance-month"),
    financeSalaryForm: document.querySelector("#salary-form"),
    financeSalary: document.querySelector("#salary-amount"),
    financeSalaryTotal: document.querySelector("#salary-total"),
    financeExpenseForm: document.querySelector("#expense-form"),
    financeExpenseLabel: document.querySelector("#expense-label"),
    financeExpenseAmount: document.querySelector("#expense-amount"),
    financeExpenseDate: document.querySelector("#expense-date"),
    financeExpenseTotal: document.querySelector("#expenses-total"),
    financeRemainder: document.querySelector("#money-left"),
    financeExpenseList: document.querySelector("#expense-list"),
    financeEmpty: document.querySelector("#expense-empty"),
    financeMessage: document.querySelector("#finance-message"),
    financeSetup: document.querySelector("#finance-setup"),
    shareNotice: document.querySelector("#share-notice"),
    storageLabel: document.querySelector("#storage-label"),
    previousWeek: document.querySelector("#previous-week"),
    nextWeek: document.querySelector("#next-week"),
    currentWeek: document.querySelector("#current-week"),
    leaveShared: document.querySelector("#leave-shared"),
    form: document.querySelector("#event-form"),
    formTitle: document.querySelector("#form-title"),
    eventId: document.querySelector("#event-id"),
    title: document.querySelector("#event-title"),
    category: document.querySelector("#event-category"),
    date: document.querySelector("#event-date"),
    start: document.querySelector("#event-start"),
    end: document.querySelector("#event-end"),
    location: document.querySelector("#event-location"),
    note: document.querySelector("#event-note"),
    cancelled: document.querySelector("#event-cancelled"),
    cancelledOption: document.querySelector("#cancelled-option"),
    completed: document.querySelector("#event-completed"),
    completedOption: document.querySelector("#completed-option"),
    error: document.querySelector("#form-error"),
    delete: document.querySelector("#delete-event"),

  };

  const authEls = {
    panel: document.querySelector("#auth-panel"), setupPanel: document.querySelector("#setup-panel"),
    setupMessage: document.querySelector("#setup-message"), plannerApp: document.querySelector("#planner-app"),
    form: document.querySelector("#auth-form"), email: document.querySelector("#auth-email"), password: document.querySelector("#auth-password"),
    message: document.querySelector("#auth-message"), signIn: document.querySelector("#sign-in"),
    signUp: document.querySelector("#sign-up"), signOut: document.querySelector("#sign-out"),
    retryPlanner: document.querySelector("#retry-planner"), migrationPanel: document.querySelector("#migration-panel"),
    importLocal: document.querySelector("#import-local")
  };
  const sharedSnapshot = readSharedSnapshot();
  const sharedMode = Boolean(sharedSnapshot);
  const sharedDraftKey = sharedSnapshot ? `${STORAGE_KEY}.shared.${sharedSnapshot.encoded}` : "";
  // The legacy cache has no account owner: never offer it to another user.
  const localEvents = [];
  function clearLegacyCache() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be disabled. */ }
  }
  if (!sharedSnapshot) clearLegacyCache();
  let events = sharedSnapshot ? loadEvents(sharedDraftKey, sharedSnapshot.events) : [...localEvents];
  let weekStart = sharedSnapshot ? parseDate(sharedSnapshot.week) : mondayOf(new Date());
  let activeFilter = "all";
  let draggedActivityId = null;
  let movingActivity = false;
  let realtimeChannel = null;
  let realtimeTimer = null;
  let realtimePending = new Set();
  let cloudRequest = 0;
  let plannerId = null;
  let currentUser = null;
  let financeMonth = dateKey(new Date()).slice(0, 7);
  let recurringBills = [];
  let paidBillIds = new Set();
  let billsReady = false;
  let financeRequest = 0;
  let monthlyCarry = 0;
  let financeOptionsReady = false;
  let editingExpenseId = null;
  const expenseCategories = { groceries: "Courses", transport: "Transport", housing: "Logement", health: "Santé", leisure: "Loisirs", bills: "Factures", other: "Autres" };
  let monthlySalary = null;
  let monthlyExpenses = [];
  const moneyFormat = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

  function errorMessage(error, fallback) {
    const code = String(error?.code || "");
    const messages = {
      invalid_credentials: "Adresse e-mail ou mot de passe incorrect.",
      email_not_confirmed: "Confirme ton adresse e-mail avant de te connecter.",
      user_already_exists: "Un compte existe déjà avec cette adresse e-mail.",
      email_exists: "Un compte existe déjà avec cette adresse e-mail.",
      weak_password: "Choisis un mot de passe plus robuste.",
      over_request_rate_limit: "Trop de tentatives. Réessaie dans quelques instants.",
      over_email_send_rate_limit: "Trop d’e-mails demandés. Réessaie dans quelques instants.",
      session_expired: "Ta session a expiré. Reconnecte-toi.",
      "42501": "Accès refusé. Vérifie les droits de ton compte sur ce planning.",
      "23514": "Les données saisies ne respectent pas les règles du planning.",
      "23505": "Cet enregistrement existe déjà.",
      PGRST205: "La configuration de la base de données est incomplète.",
      "42P01": "La configuration de la base de données est incomplète."
    };
    if (messages[code]) return messages[code];
    if (error?.status === 429) return "Trop de tentatives. Réessaie dans quelques instants.";
    if (error?.name === "TypeError" || error?.name === "AuthRetryableFetchError") return "Connexion impossible. Vérifie ta connexion Internet puis réessaie.";
    return fallback;
  }

  function showAuth(message = "") {
    document.title = "Semaine pour Guyane";
    authEls.panel.hidden = false; authEls.setupPanel.hidden = true; authEls.plannerApp.hidden = true;
    authEls.signOut.hidden = true; els.storageLabel.textContent = "Connexion requise"; authEls.message.textContent = message;
  }
  function showSetup(message) {
    authEls.panel.hidden = true; authEls.setupPanel.hidden = false; authEls.plannerApp.hidden = true;
    authEls.signOut.hidden = false; els.storageLabel.textContent = "Compte connecté"; authEls.setupMessage.textContent = message;
  }
  function showPlanner() {
    authEls.panel.hidden = true; authEls.setupPanel.hidden = true; authEls.plannerApp.hidden = false;
    authEls.signOut.hidden = !currentUser;
    els.financePanel.hidden = sharedMode || !plannerId;
    document.querySelector("#budget-shortcut").hidden = els.financePanel.hidden;
    setMobilePage(mobilePageFromUrl());
  }
  function toDatabaseEvent(event) {
    return { id: event.id, planner_id: plannerId, title: event.title, category: event.category,
      activity_date: event.date, start_time: event.start, end_time: event.end,
      location: event.location || null, note: event.note || null,
      cancelled: Boolean(event.cancelled), completed: Boolean(event.completed) };
  }
  function fromDatabaseEvent(row) {
    return { id: row.id, title: row.title, category: row.category, date: row.activity_date,
      start: String(row.start_time).slice(0, 5), end: String(row.end_time).slice(0, 5),
      location: row.location || "", note: row.note || "",
      cancelled: row.cancelled === true, completed: row.completed === true };
  }
  async function loadCloudEvents() {
    const request = ++cloudRequest;
    const requestedPlanner = plannerId, requestedUser = currentUser?.id;
    if (!requestedPlanner) return;
    const rows = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from("activities")
        .select("id,title,category,activity_date,start_time,end_time,location,note,cancelled,completed")
        .eq("planner_id", requestedPlanner).order("activity_date").order("start_time").order("id")
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      if (request !== cloudRequest || plannerId !== requestedPlanner || currentUser?.id !== requestedUser) return;
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    if (request !== cloudRequest || plannerId !== requestedPlanner || currentUser?.id !== requestedUser) return;
    events = rows.map(fromDatabaseEvent);
    authEls.migrationPanel.hidden = !(events.length === 0 && localEvents.length > 0);
    render();
  }
  function monthBounds(month) {
    const [year, monthNumber] = month.split("-").map(Number);
    return { start: `${month}-01`, end: dateKey(new Date(year, monthNumber, 1)) };
  }
  function defaultFinanceDate(month) {
    const today = dateKey(new Date());
    return today.startsWith(`${month}-`) ? today : `${month}-01`;
  }
  function renderFinance() {
    const expensesTotal = monthlyExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    if (!els.financeSalaryForm.contains(document.activeElement)) els.financeSalary.value = monthlySalary === null ? "" : Number(monthlySalary).toFixed(2);
    els.financeSalaryTotal.textContent = monthlySalary === null ? "À renseigner" : moneyFormat.format(Number(monthlySalary));
    els.financeExpenseTotal.textContent = moneyFormat.format(expensesTotal);
    els.financeRemainder.textContent = monthlySalary === null ? "—" : moneyFormat.format(Number(monthlySalary) + monthlyCarry - expensesTotal);
    els.financeRemainder.classList.toggle("is-negative", monthlySalary !== null && Number(monthlySalary) + monthlyCarry - expensesTotal < 0);
    document.querySelector("#carry-card").hidden = !financeOptionsReady;
    document.querySelector("#carry-total").textContent = moneyFormat.format(monthlyCarry);
    document.querySelector("#carry-previous").disabled = !financeOptionsReady;
    document.querySelector("#expense-category").disabled = !financeOptionsReady;
    renderExpenseChart();
    els.financeExpenseList.replaceChildren();
    els.financeEmpty.hidden = monthlyExpenses.length > 0;
    for (const expense of monthlyExpenses) {
      const row = document.createElement("li");
      row.className = "expense-row";
      const details = document.createElement("span");
      details.className = "expense-details";
      const label = document.createElement("strong");
      label.textContent = expense.label;
      const date = document.createElement("small");
      date.textContent = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(parseDate(expense.expense_date));
      if (financeOptionsReady) date.textContent += ` · ${expenseCategories[expense.category] || expenseCategories.other}`;
      details.append(label, date);
      const amount = document.createElement("strong");
      amount.className = "expense-amount";
      amount.textContent = `−${moneyFormat.format(Number(expense.amount))}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "expense-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Supprimer la dépense ${expense.label}`);
      remove.addEventListener("click", () => deleteExpense(expense.id));
      const edit = document.createElement("button"); edit.type = "button"; edit.className = "expense-edit"; edit.textContent = "Modifier";
      edit.setAttribute("aria-label", `Modifier la dépense ${expense.label}`); edit.addEventListener("click", () => editExpense(expense));
      const actions = document.createElement("div"); actions.className = "expense-actions"; actions.append(edit, remove);
      row.append(details, amount, actions);
      els.financeExpenseList.append(row);
    }
  }
  async function loadFinanceData() {
    if (!plannerId || sharedMode) return;
    const request = ++financeRequest;
    const requestedPlanner = plannerId;
    const requestedMonth = financeMonth;
    const isCurrent = () => request === financeRequest && plannerId === requestedPlanner && financeMonth === requestedMonth;
    const { start, end } = monthBounds(requestedMonth);
    monthlySalary = null; monthlyCarry = 0; financeOptionsReady = false;
    monthlyExpenses = [];
    billsReady = false; recurringBills = []; paidBillIds = new Set();
    renderBills();
    renderFinance();
    els.financeMessage.textContent = "Chargement du suivi financier…";
    els.financeSetup.hidden = true;
    els.financeEmpty.hidden = true;
    els.financeExpenseList.replaceChildren();
    try {
      const [budgetResult, expensesResult] = await Promise.all([
        supabase.from("planner_monthly_budgets").select("salary").eq("planner_id", plannerId).eq("month_start", start).maybeSingle(),
        readExpenseRows(requestedPlanner, requestedMonth, "id,label,amount,expense_date")
      ]);
      if (!isCurrent()) return;
      if (budgetResult.error) throw budgetResult.error;
      if (expensesResult.error) throw expensesResult.error;
      monthlySalary = budgetResult.data ? Number(budgetResult.data.salary) : null;
      monthlyExpenses = expensesResult.data || [];
      renderFinance();
      els.financeMessage.textContent = "";
      await Promise.all([loadBills(request, requestedPlanner, requestedMonth), loadFinanceOptions(request, requestedPlanner, requestedMonth)]);
    } catch (error) {
      if (!isCurrent()) return;
      els.financeMessage.textContent = error.code === "42501"
        ? "L’accès au suivi financier a été refusé. Vérifie les règles d’accès Supabase."
        : "Impossible de charger le suivi financier. Vérifie ta connexion.";
      els.financeSetup.hidden = !["PGRST205", "42P01"].includes(error.code);
    }
  }
  for (const [key, label] of Object.entries(expenseCategories)) {
    const option = document.createElement("option"); option.value = key; option.textContent = label;
    document.querySelector("#expense-category").append(option);
  }
  document.querySelector("#expense-category").value = "other";
  function expenseCategoryTotals(expenses) {
    return Object.entries(expenseCategories).map(([key, label]) => ({ key, label, amount: expenses.filter(expense => (expense.category || "other") === key).reduce((sum, expense) => sum + Number(expense.amount), 0) })).filter(row => row.amount > 0);
  }
  function renderExpenseChart() {
    const chart = document.querySelector("#expense-chart"); chart.replaceChildren();
    if (!financeOptionsReady) { chart.textContent = "La répartition par catégorie nécessite la nouvelle configuration du budget."; return; }
    const totals = expenseCategoryTotals(monthlyExpenses), total = totals.reduce((sum, row) => sum + row.amount, 0);
    if (!total) { chart.textContent = "Aucune dépense pour ce mois."; return; }
    for (const item of totals) {
      const row = document.createElement("div"); row.className = "chart-row";
      const text = document.createElement("span"); text.textContent = `${item.label} · ${moneyFormat.format(item.amount)} (${Math.round(item.amount / total * 100)} %)`;
      const track = document.createElement("div"); track.className = "chart-track"; track.setAttribute("aria-hidden", "true");
      const bar = document.createElement("div"); bar.className = `chart-bar expense-category-${item.key}`; bar.style.width = `${item.amount / total * 100}%`;
      track.append(bar); row.append(text, track); chart.append(row);
    }
  }
  async function readExpenseRows(planner, month, columns) {
    const { start, end } = monthBounds(month), rows = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("planner_expenses").select(columns).eq("planner_id", planner).gte("expense_date", start).lt("expense_date", end).order("expense_date").order("id").range(offset, offset + 499);
      if (error) return { data: null, error };
      rows.push(...(data || [])); if (!data || data.length < 500) return { data: rows, error: null };
    }
  }
  async function loadFinanceOptions(request, planner, month) {
    const [budget, categoriesResult] = await Promise.all([
      supabase.from("planner_monthly_budgets").select("carry_amount").eq("planner_id", planner).eq("month_start", `${month}-01`).maybeSingle(),
      readExpenseRows(planner, month, "id,category")
    ]);
    if (request !== financeRequest || planner !== plannerId || month !== financeMonth) return;
    const error = budget.error || categoriesResult.error;
    financeOptionsReady = !error;
    monthlyCarry = error ? 0 : Number(budget.data?.carry_amount || 0);
    const categoryMap = new Map((categoriesResult.data || []).map(row => [row.id, row.category]));
    monthlyExpenses = monthlyExpenses.map(expense => ({ ...expense, category: categoryMap.get(expense.id) || "other" }));
    document.querySelector("#finance-options-message").textContent = error ? "Catégories et report indisponibles : vérifie la configuration Supabase du budget." : "";
    renderFinance();
  }
  function resetExpenseForm() {
    editingExpenseId = null; els.financeExpenseForm.reset();
    els.financeExpenseDate.value = defaultFinanceDate(financeMonth);
    document.querySelector("#expense-category").value = "other";
    document.querySelector("#expense-form-heading").textContent = "Ajouter une dépense";
    els.financeExpenseForm.querySelector("button[type=submit]").textContent = "Ajouter la dépense";
    document.querySelector("#cancel-expense-edit").hidden = true;
  }
  function editExpense(expense) {
    editingExpenseId = expense.id;
    els.financeExpenseLabel.value = expense.label; els.financeExpenseAmount.value = expense.amount;
    els.financeExpenseDate.value = expense.expense_date; document.querySelector("#expense-category").value = expense.category || "other";
    document.querySelector("#expense-form-heading").textContent = "Modifier une dépense";
    els.financeExpenseForm.querySelector("button[type=submit]").textContent = "Enregistrer la modification";
    document.querySelector("#cancel-expense-edit").hidden = false;
    els.financeExpenseForm.scrollIntoView({ block: "start" }); els.financeExpenseLabel.focus({ preventScroll: true });
  }
  document.querySelector("#cancel-expense-edit").addEventListener("click", resetExpenseForm);
  document.querySelector("#carry-previous").addEventListener("click", async event => {
    if (!financeOptionsReady || !plannerId) return;
    const planner = plannerId, month = financeMonth, button = event.target;
    const previous = dateKey(addDays(parseDate(`${month}-01`), -1)).slice(0, 7);
    button.disabled = true;
    try {
      const [budget, expenses] = await Promise.all([
        supabase.from("planner_monthly_budgets").select("salary,carry_amount").eq("planner_id", planner).eq("month_start", `${previous}-01`).maybeSingle(),
        readExpenseRows(planner, previous, "amount")
      ]);
      if (budget.error) throw budget.error; if (expenses.error) throw expenses.error;
      if (planner !== plannerId || month !== financeMonth) return;
      if (!budget.data) { els.financeMessage.textContent = "Renseigne d’abord le budget du mois précédent pour calculer son solde."; return; }
      const balance = Math.round((Number(budget.data.salary) + Number(budget.data.carry_amount || 0) - (expenses.data || []).reduce((sum, expense) => sum + Number(expense.amount), 0)) * 100) / 100;
      if (!window.confirm(`Reporter ${moneyFormat.format(balance)} depuis ${previous} ? Ce montant remplacera le report actuel, sans s’y ajouter.`)) return;
      const { error } = await supabase.from("planner_monthly_budgets").upsert({ planner_id: planner, month_start: `${month}-01`, carry_amount: balance, updated_at: new Date().toISOString() }, { onConflict: "planner_id,month_start", defaultToNull: false });
      if (error) throw error;
      if (planner === plannerId && month === financeMonth) { await loadFinanceData(); els.financeMessage.textContent = "Solde reporté. Recalcule-le si tu modifies le mois précédent."; }
    } catch (error) { if (planner === plannerId && month === financeMonth) els.financeMessage.textContent = errorMessage(error, "Impossible de reporter le solde."); }
    finally { button.disabled = !financeOptionsReady; }
  });

  function billDueDate(month, day) {
    const [year, number] = month.split("-").map(Number);
    const lastDay = new Date(year, number, 0).getDate();
    return `${month}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
  }
  async function loadBills(request, requestedPlanner, requestedMonth) {
    const { start, end } = monthBounds(requestedMonth);
    const [bills, paid] = await Promise.all([
      supabase.from("planner_recurring_bills").select("id,label,amount,due_day,start_month").eq("planner_id", requestedPlanner).eq("active", true).order("due_day").order("label"),
      readExpenseRows(requestedPlanner, requestedMonth, "recurring_bill_id")
    ]);
    if (request !== financeRequest || requestedPlanner !== plannerId || requestedMonth !== financeMonth) return;
    const error = bills.error || paid.error;
    billsReady = !error;
    recurringBills = error ? [] : bills.data || [];
    paidBillIds = new Set((paid.data || []).map(row => row.recurring_bill_id).filter(Boolean));
    renderBills();
    document.querySelector("#bill-setup").hidden = !error || !["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code);
    if (error) document.querySelector("#bill-status").textContent = errorMessage(error, "Impossible de charger les factures mensuelles. Réessaie en sélectionnant le mois.");
  }
  function renderBills() {
    const suggestions = document.querySelector("#bill-suggestions"), list = document.querySelector("#bill-list");
    suggestions.replaceChildren(); list.replaceChildren();
    document.querySelector("#bill-form button").disabled = !billsReady;
    const today = dateKey(new Date());
    for (const bill of recurringBills) {
      const due = billDueDate(financeMonth, bill.due_day);
      const row = document.createElement("div"); row.className = "bill-row";
      const label = document.createElement("span"); label.textContent = `${bill.label} · ${moneyFormat.format(Number(bill.amount))} · le ${bill.due_day}`;
      const stop = document.createElement("button"); stop.type = "button"; stop.className = "cancel-button"; stop.textContent = "Arrêter";
      stop.setAttribute("aria-label", `Arrêter la facture mensuelle ${bill.label}`);
      stop.addEventListener("click", () => stopBill(bill, stop));
      row.append(label, stop); list.append(row);
      if (bill.start_month > `${financeMonth}-01` || due > today || paidBillIds.has(bill.id)) continue;
      const suggestion = document.createElement("div"); suggestion.className = "bill-row";
      const text = document.createElement("span"); text.textContent = `${bill.label} · ${moneyFormat.format(Number(bill.amount))} · échéance le ${due.slice(8)}`;
      const add = document.createElement("button"); add.type = "button"; add.className = "save-button"; add.textContent = "Ajouter";
      add.setAttribute("aria-label", `Ajouter la facture ${bill.label} aux dépenses`);
      add.addEventListener("click", () => addBillExpense(bill, due, add));
      suggestion.append(text, add); suggestions.append(suggestion);
    }
    document.querySelector("#bill-status").textContent = !billsReady ? "Chargement des factures…" : suggestions.children.length ? "À confirmer : ces factures ne sont pas encore dans tes dépenses." : "Aucune facture en attente pour cette période.";
  }
  async function changeBill(button, action, success, onSuccess = () => {}) {
    const month = financeMonth, planner = plannerId;
    button.disabled = true;
    try {
      const { error } = await action();
      if (month !== financeMonth || planner !== plannerId) return;
      if (error && error.code !== "23505") throw error;
      if (!error) onSuccess();
      await loadFinanceData();
      if (month === financeMonth && planner === plannerId) document.querySelector("#bill-status").textContent = error ? "Cette facture est déjà ajoutée pour ce mois." : success;
    } catch (error) {
      if (month === financeMonth && planner === plannerId) document.querySelector("#bill-status").textContent = errorMessage(error, "Impossible d’enregistrer cette facture. Réessaie.");
    } finally { button.disabled = false; }
  }
  async function addBillExpense(bill, due, button) {
    if (!billsReady || paidBillIds.has(bill.id)) return;
    await changeBill(button, () => supabase.from("planner_expenses").insert({ planner_id: plannerId, label: bill.label, amount: bill.amount, expense_date: due, recurring_bill_id: bill.id, ...(financeOptionsReady ? { category: "bills" } : {}) }), "Facture ajoutée aux dépenses.");
  }
  async function stopBill(bill, button) {
    if (!window.confirm(`Arrêter les propositions mensuelles pour « ${bill.label} » ? Les dépenses déjà ajoutées seront conservées.`)) return;
    await changeBill(button, () => supabase.from("planner_recurring_bills").update({ active: false }).eq("id", bill.id).eq("planner_id", plannerId), "Facture mensuelle arrêtée.");
  }
  document.querySelector("#bill-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!billsReady || !plannerId) return;
    const label = document.querySelector("#bill-label").value.trim();
    const amount = Number(document.querySelector("#bill-amount").value), due_day = Number(document.querySelector("#bill-day").value);
    if (!label || label.length > 80 || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(due_day) || due_day < 1 || due_day > 31) return;
    await changeBill(event.target.querySelector("button"), () => supabase.from("planner_recurring_bills").insert({ planner_id: plannerId, label, amount, due_day, start_month: `${financeMonth}-01` }), "Facture mensuelle enregistrée.", () => event.target.reset());
  });
  // Refresh due proposals after midnight or when returning to an already open app.
  document.addEventListener("visibilitychange", () => { if (!document.hidden && plannerId && !sharedMode) loadFinanceData(); });
  window.setInterval(() => { if (!document.hidden && billsReady) renderBills(); }, 60000);

  async function saveMonthlySalary(event) {
    event.preventDefault();
    const salary = Number(els.financeSalary.value);
    if (!els.financeSalary.value || !Number.isFinite(salary) || salary < 0) {
      els.financeMessage.textContent = "Saisis un salaire mensuel valide.";
      return;
    }
    const button = els.financeSalaryForm.querySelector("button[type=submit]");
    button.disabled = true;
    const savedMonth = financeMonth, savedPlanner = plannerId;
    const isCurrent = () => savedMonth === financeMonth && savedPlanner === plannerId;
    try {
      const { error } = await supabase.from("planner_monthly_budgets").upsert({
        planner_id: plannerId, month_start: `${financeMonth}-01`, salary, updated_at: new Date().toISOString()
      }, { onConflict: "planner_id,month_start" });
      if (error) throw error;
      if (!isCurrent()) return;
      await loadFinanceData();
      if (isCurrent()) els.financeMessage.textContent = "Salaire enregistré.";
    } catch (error) {
      if (!isCurrent()) return;
      els.financeMessage.textContent = errorMessage(error, "Le salaire n’a pas pu être enregistré.");
    } finally { button.disabled = false; }
  }
  async function saveExpense(event) {
    event.preventDefault();
    const label = els.financeExpenseLabel.value.trim();
    const amount = Number(els.financeExpenseAmount.value);
    const expenseDate = els.financeExpenseDate.value;
    if (!label || label.length > 80 || !Number.isFinite(amount) || amount <= 0 ||
        !expenseDate || !expenseDate.startsWith(`${financeMonth}-`)) {
      els.financeMessage.textContent = "Vérifie le nom, le montant et le jour de cette dépense.";
      return;
    }
    const button = els.financeExpenseForm.querySelector("button[type=submit]");
    button.disabled = true;
    const savedMonth = financeMonth, savedPlanner = plannerId;
    const isCurrent = () => savedMonth === financeMonth && savedPlanner === plannerId;
    try {
      const payload = { planner_id: plannerId, label, amount, expense_date: expenseDate };
      if (financeOptionsReady) payload.category = document.querySelector("#expense-category").value;
      const { error } = editingExpenseId
        ? await supabase.from("planner_expenses").update(payload).eq("id", editingExpenseId).eq("planner_id", savedPlanner)
        : await supabase.from("planner_expenses").insert(payload);
      if (error) throw error;
      if (!isCurrent()) return;
      resetExpenseForm();
      await loadFinanceData();
      if (isCurrent()) els.financeMessage.textContent = "Dépense enregistrée.";
    } catch (error) {
      if (!isCurrent()) return;
      els.financeMessage.textContent = errorMessage(error, "La dépense n’a pas pu être enregistrée.");
    } finally { button.disabled = false; }
  }
  async function deleteExpense(id) {
    if (!window.confirm("Supprimer cette dépense ?")) return;
    const savedMonth = financeMonth, savedPlanner = plannerId;
    const isCurrent = () => savedMonth === financeMonth && savedPlanner === plannerId;
    try {
      const { error } = await supabase.from("planner_expenses").delete().eq("id", id).eq("planner_id", plannerId);
      if (error) throw error;
      if (!isCurrent()) return;
      await loadFinanceData();
      if (isCurrent()) els.financeMessage.textContent = "Dépense supprimée.";
    } catch (error) {
      if (!isCurrent()) return;
      els.financeMessage.textContent = errorMessage(error, "La dépense n’a pas pu être supprimée.");
    }
  }

  async function handleAuthenticated(user, force = false) {
    if (!user || (!force && currentUser?.id === user.id && plannerId)) return;
    currentUser = user;
    const { data: memberships, error } = await supabase.from("planner_members").select("planner_id,role").limit(1);
    if (currentUser?.id !== user.id) return;
    if (error) { plannerId = null; showSetup("Connexion réussie, mais impossible de lire le planning. Vérifie les règles d’accès."); return; }
    if (!memberships?.length) { plannerId = null; showSetup("Ce compte n’est pas encore relié au planning. Une étape de configuration dans Supabase reste à faire."); return; }
    plannerId = memberships[0].planner_id;
    showPlanner();
    startRealtime();
    try { await loadCloudEvents(); await loadFinanceData(); }
    catch (error) {
      authEls.setupMessage.textContent = errorMessage(error, "Impossible de charger les activités.");
      authEls.setupPanel.hidden = false; authEls.plannerApp.hidden = true; els.storageLabel.textContent = "Erreur de synchronisation";
    }
  }
  async function bootstrap() {
    if (sharedMode) { showPlanner(); render(); return; }
    const { data, error } = await supabase.auth.getSession();
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        ++financeRequest; ++cloudRequest; stopRealtime(); currentUser = null; plannerId = null; events = [];
        resetExpenseForm(); els.financeSalaryForm.reset(); document.querySelector("#bill-form").reset();
        monthlySalary = null; monthlyExpenses = []; monthlyCarry = 0; financeOptionsReady = false; editingExpenseId = null;
        recurringBills = []; paidBillIds = new Set(); billsReady = false;
        renderFinance(); renderBills(); render(); clearLegacyCache(); showAuth();
      }
      else if (session?.user && event !== "INITIAL_SESSION") window.setTimeout(() => handleAuthenticated(session.user), 0);
    });
    if (error) { showAuth("Impossible de vérifier la session. Recharge la page."); return; }
    if (data.session?.user) await handleAuthenticated(data.session.user);
    else showAuth();
  }
  async function authenticate(mode) {
    const email = authEls.email.value.trim(), password = authEls.password.value;
    authEls.message.textContent = "";
    if (!email || !password) { authEls.message.textContent = "Saisis ton adresse e-mail et ton mot de passe."; return; }
    authEls.signIn.disabled = true; authEls.signUp.disabled = true;
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (data.session && data.user) await handleAuthenticated(data.user, true);
        else authEls.message.textContent = "Compte créé. Confirme ton adresse e-mail, puis connecte-toi.";
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await handleAuthenticated(data.user, true);
      }
    } catch (error) { authEls.message.textContent = errorMessage(error, "La connexion a échoué."); }
    finally { authEls.signIn.disabled = false; authEls.signUp.disabled = false; }
  }
  async function importLocalEvents() {
    if (!plannerId || !localEvents.length) return;
    authEls.importLocal.disabled = true;
    try {
      const records = localEvents.filter(isValidEvent).map(event => ({ ...toDatabaseEvent({ ...event, id: crypto.randomUUID() }) }));
      const { error } = await supabase.from("activities").insert(records);
      if (error) throw error;
      await loadCloudEvents();
    } catch (error) { authEls.setupMessage.textContent = errorMessage(error, "L’import a échoué."); }
    finally { authEls.importLocal.disabled = false; }
  }

  function loadEvents(storageKey = STORAGE_KEY, fallback = []) {
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw === null ? fallback : JSON.parse(raw);
      if (!Array.isArray(saved)) return [];
      return saved
        .map((event) => event?.category === "travel" ? { ...event, category: "other" } : event)
        .map((event) => event ? { ...event, cancelled: event.cancelled === true, completed: event.completed === true } : event)
        .filter(isValidEvent);
    } catch {
      return [];
    }
  }

  function isValidDateKey(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = parseDate(value);
    return Number.isFinite(parsed.getTime()) && dateKey(parsed) === value;
  }

  function isValidEvent(event) {
    return Boolean(event) &&
      typeof event.id === "string" && event.id.length <= 80 &&
      typeof event.title === "string" && event.title.trim().length > 0 && event.title.length <= 80 &&
      isValidDateKey(event.date) &&
      Object.hasOwn(categories, event.category) &&
      /^\d{2}:\d{2}$/.test(event.start) &&
      /^\d{2}:\d{2}$/.test(event.end) &&
      event.end > event.start &&
      (event.location === undefined || (typeof event.location === "string" && event.location.length <= 100)) &&
      (event.note === undefined || (typeof event.note === "string" && event.note.length <= 240));
  }

  function readSharedSnapshot() {
    const match = location.hash.match(/^#share=([A-Za-z0-9_-]+)$/);
    if (!match) return null;
    try {
      const base64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
      const payload = JSON.parse(new TextDecoder().decode(bytes));
      if (payload.version !== 1 || !isValidDateKey(payload.week)) return null;
      const start = mondayOf(parseDate(payload.week));
      if (dateKey(start) !== payload.week || !Array.isArray(payload.events) || payload.events.length > 100) return null;
      const end = dateKey(addDays(start, 6));
      const validEvents = payload.events
        .map((event) => event?.category === "travel" ? { ...event, category: "other" } : event)
        .map((event) => event ? { ...event, cancelled: event.cancelled === true, completed: event.completed === true } : event)
        .filter((event) => isValidEvent(event) && event.date >= payload.week && event.date <= end);
      return { week: payload.week, events: validEvents, encoded: match[1] };
    } catch {
      return null;
    }
  }

  function saveEvents() {
    try {
      localStorage.setItem(sharedMode ? sharedDraftKey : STORAGE_KEY, JSON.stringify(events));
      if (sharedMode) {
        els.shareNotice.textContent = "Tes changements restent dans cette copie sur cet appareil et ne modifient pas le planning partagé.";
      }
    } catch {
      els.error.textContent = "Le navigateur n’a pas pu enregistrer les changements.";
    }
  }

  function leaveSharedCopy() {
    history.replaceState(null, "", location.pathname);
    location.reload();
  }

  function mondayOf(date) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const weekday = (result.getDay() + 6) % 7;
    result.setDate(result.getDate() - weekday);
    return result;
  }

  function addDays(date, amount) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
  }

  function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatWeek(start) {
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const left = new Intl.DateTimeFormat("fr-FR", { day: "numeric", ...(sameMonth ? {} : { month: "short" }) }).format(start);
    const right = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(end);
    return sameMonth ? `${left} – ${right}` : `${left} – ${right}`;
  }

  function render() {
    els.weekLabel.textContent = formatWeek(weekStart);
    els.storageLabel.textContent = sharedMode ? "Copie partagée" : plannerId ? "Synchronisé dans le cloud" : currentUser ? "Compte connecté" : "Connexion requise";
    els.previousWeek.disabled = sharedMode;
    els.nextWeek.disabled = sharedMode;
    els.currentWeek.hidden = sharedMode;
    els.leaveShared.hidden = !sharedMode;
    els.shareNotice.hidden = !sharedMode;
    document.querySelector("#copy-previous-week").hidden = sharedMode;
    renderReport();
    renderDays();
  }

  const mobileLayout = window.matchMedia("(max-width: 900px)");
  function mobilePageFromUrl() {
    const value = new URL(location.href).searchParams.get("view");
    return ["planning", "report", "budget"].includes(value) ? value : "planning";
  }
  function setMobilePage(page, navigate = false) {
    if (mobileLayout.matches && activeFilter !== "all") {
      activeFilter = "all";
      document.querySelectorAll(".filter-chip").forEach(chip => {
        const selected = chip.dataset.filter === "all";
        chip.classList.toggle("is-active", selected); chip.setAttribute("aria-pressed", String(selected));
      });
      renderDays();
    }
    if (!["planning", "report", "budget"].includes(page)) page = "planning";
    if (page === "budget" && (sharedMode || els.financePanel.hidden)) page = "planning";
    authEls.plannerApp.dataset.mobilePage = page;
    document.title = mobileLayout.matches ? `${{ planning: "Planning", report: "Rapport", budget: "Budget" }[page]} · Semaine pour Guyane` : "Semaine pour Guyane";
    for (const link of document.querySelectorAll(".mobile-sections a")) {
      const target = new URL(location.href); target.searchParams.set("view", link.dataset.page); link.href = target.href;
      if (link.dataset.page === page) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    if (navigate) {
      const url = new URL(location.href); url.searchParams.set("view", page);
      if (url.href !== location.href) history.pushState(null, "", url);
      window.scrollTo(0, 0);
      const heading = document.querySelector(page === "planning" ? "#week-label" : page === "report" ? "#report-heading" : "#finance-heading");
      heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true });
    }
  }
  document.querySelectorAll(".mobile-sections a").forEach(link => {
    link.addEventListener("click", event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (mobileLayout.matches) setMobilePage(link.dataset.page, true);
    });
  });
  window.addEventListener("popstate", () => { setMobilePage(mobilePageFromUrl()); if (mobileLayout.matches) window.scrollTo(0, 0); });
  mobileLayout.addEventListener("change", () => setMobilePage(mobilePageFromUrl()));

  const report = Object.fromEntries(["period", "month", "start", "end", "message", "body", "cards"].map(name => [name, document.querySelector(`#report-${name}`)]));
  report.month.value = financeMonth;
  report.start.value = dateKey(weekStart);
  report.end.value = dateKey(addDays(weekStart, 6));
  for (const field of [report.period, report.month, report.start, report.end]) field.addEventListener("change", renderReport);

  function renderReport() {
    const period = report.period.value;
    for (const name of ["month", "start", "end"]) {
      document.querySelector(`#report-${name}-field`).hidden = name === "month" ? period !== "month" : period !== "custom";
    }
    let start = "", end = "";
    if (period === "week") { start = dateKey(weekStart); end = dateKey(addDays(weekStart, 6)); }
    if (period === "month" && report.month.value) {
      const bounds = monthBounds(report.month.value);
      start = bounds.start;
      end = dateKey(addDays(parseDate(bounds.end), -1));
    }
    if (period === "custom") { start = report.start.value; end = report.end.value; }
    report.body.replaceChildren();
    report.cards.replaceChildren();
    if ((period === "month" && !report.month.value) || (period === "custom" && (!start || !end || start > end))) {
      report.message.textContent = "Choisis une période valide : la date de début doit précéder ou être égale à la date de fin.";
      return;
    }
    const selected = events.filter(event => (!start || event.date >= start) && (!end || event.date <= end));
    report.message.textContent = (sharedMode ? "Cette copie uniquement · " : "") +
      (selected.length ? `${selected.length} activité(s) enregistrée(s).` : "Aucune activité sur cette période.");
    for (const [category, label] of [["all", "Général"], ...Object.entries(categories).map(([key, value]) => [key, value.label])]) {
      const records = category === "all" ? selected : selected.filter(event => event.category === category);
      const cancelled = records.filter(event => event.cancelled).length;
      const completed = records.filter(event => event.completed && !event.cancelled).length;
      const row = document.createElement("tr");
      const heading = document.createElement("th"); heading.scope = "row"; heading.textContent = label; row.append(heading);
      for (const value of [records.length, cancelled, completed, records.length ? `${Math.round(completed / records.length * 100)} %` : "—"]) {
        const cell = document.createElement("td"); cell.textContent = value; row.append(cell);
      }
      report.body.append(row);
      const card = document.createElement("article"); card.className = "report-card";
      const title = document.createElement("h3"); title.textContent = label;
      const list = document.createElement("dl");
      const labels = ["Enregistrées", "Annulées", "Accomplies", "Taux d’accomplissement"];
      const cells = [...row.querySelectorAll("td")];
      [3, 0, 1, 2].forEach(index => {
        const cell = cells[index];
        const term = document.createElement("dt"); term.textContent = labels[index];
        const value = document.createElement("dd"); value.textContent = cell.textContent;
        if (index === 3) { term.className = "report-rate-label"; value.className = "report-rate"; }
        list.append(term, value);
      });
      card.append(title, list); report.cards.append(card);
    }
  }

  function activitySignature(event) {
    return JSON.stringify([event.date, event.title.trim(), event.category, event.start, event.end, event.location || "", event.note || ""]);
  }
  async function copyActivityId(sourceId, targetDate, planner) {
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([planner, sourceId, targetDate]))));
    hash[6] = (hash[6] & 15) | 64; hash[8] = (hash[8] & 63) | 128;
    const hex = [...hash.slice(0, 16)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  async function copyPreviousWeek() {
    if (!plannerId || sharedMode) return;
    const planner = plannerId, targetWeek = dateKey(weekStart);
    const button = document.querySelector("#copy-previous-week"), message = document.querySelector("#planning-message");
    button.disabled = true; message.textContent = "Copie en cours…";
    try {
      await loadCloudEvents();
      if (planner !== plannerId || targetWeek !== dateKey(weekStart)) return;
      const previousStart = dateKey(addDays(weekStart, -7)), previousEnd = dateKey(addDays(weekStart, -1));
      const existing = new Set(events.map(activitySignature));
      const source = events.filter(event => event.date >= previousStart && event.date <= previousEnd && !event.cancelled);
      const copies = [];
      for (const event of source) {
        const date = dateKey(addDays(parseDate(event.date), 7));
        const copy = { ...event, date, cancelled: false, completed: false };
        if (existing.has(activitySignature(copy))) continue;
        copy.id = await copyActivityId(event.id, date, planner);
        existing.add(activitySignature(copy)); copies.push(toDatabaseEvent(copy));
      }
      if (planner !== plannerId || targetWeek !== dateKey(weekStart)) return;
      if (!copies.length) { message.textContent = source.length ? "Ces activités sont déjà dans cette semaine." : "Aucune activité à copier depuis la semaine précédente."; return; }
      const { error } = await supabase.from("activities").upsert(copies, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
      if (planner !== plannerId) return;
      await loadCloudEvents();
      if (targetWeek === dateKey(weekStart)) message.textContent = "Semaine copiée. Les activités annulées sont exclues et les statuts remis à zéro.";
    } catch (error) { if (planner === plannerId) message.textContent = errorMessage(error, "Impossible de copier la semaine. Réessaie."); }
    finally { button.disabled = false; }
  }
  document.querySelector("#copy-previous-week").addEventListener("click", copyPreviousWeek);
  function makeEventCard(event) {
    const card = document.createElement("button");
    card.type = "button";
    card.draggable = true;
    card.addEventListener("dragstart", drag => { draggedActivityId = event.id; drag.dataTransfer.setData("text/plain", event.id); drag.dataTransfer.effectAllowed = "move"; });
    card.addEventListener("dragend", () => { draggedActivityId = null; document.querySelectorAll(".drop-target").forEach(day => day.classList.remove("drop-target")); });
    card.className = `event-card category-${categories[event.category].className}${event.cancelled ? " is-cancelled" : event.completed ? " is-completed" : ""}`;
    card.setAttribute("aria-label", `${categories[event.category].label}, ${event.title}, ${event.start} à ${event.end}${event.cancelled ? ", activité annulée" : event.completed ? ", activité accomplie" : ""}. Modifier`);
    card.addEventListener("click", () => openEditForm(event));

    const time = document.createElement("span");
    time.className = "event-time";
    time.textContent = `${event.start} – ${event.end}`;
    const title = document.createElement("span");
    title.className = "event-title";
    title.textContent = event.title;
    card.append(time, title);
    if (event.cancelled || event.completed) {
      const mark = document.createElement("span");
      mark.className = `event-status-mark ${event.cancelled ? "is-cancelled" : "is-completed"}`;
      mark.textContent = event.cancelled ? "×" : "✓";
      mark.setAttribute("aria-hidden", "true");
      card.append(mark);
    }

    if (event.location) {
      const location = document.createElement("span");
      location.className = "event-location";
      location.textContent = event.location;
      card.append(location);
    }
    return card;
  }

  function renderDays() {
    els.grid.replaceChildren();
    const today = dateKey(new Date());

    for (let index = 0; index < 7; index += 1) {
      const date = addDays(weekStart, index);
      const key = dateKey(date);
      const column = document.createElement("section");
      column.className = `day-column${key === today ? " is-today" : ""}`;
      column.setAttribute("aria-label", `${dayNames[index]} ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`);

      const heading = document.createElement("div");
      heading.className = "day-heading";
      const name = document.createElement("span");
      name.className = "day-name";
      name.textContent = dayNames[index];
      const number = document.createElement("span");
      number.className = "day-date";
      number.textContent = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date);
      heading.append(name, number);

      const list = document.createElement("div");
      list.className = "day-events";
      const dayEvents = events
        .filter((event) => event.date === key && (activeFilter === "all" || event.category === activeFilter))
        .sort((a, b) => a.start.localeCompare(b.start));

      if (dayEvents.length) {
        dayEvents.forEach((event) => list.append(makeEventCard(event)));
      } else {
        const empty = document.createElement("p");
        empty.className = "empty-day";
        empty.textContent = "Rien de prévu";
        list.append(empty);
      }

      column.addEventListener("dragover", event => { if (draggedActivityId) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; column.classList.add("drop-target"); } });
      column.addEventListener("dragleave", event => { if (!column.contains(event.relatedTarget)) column.classList.remove("drop-target"); });
      column.addEventListener("drop", event => { event.preventDefault(); column.classList.remove("drop-target"); const id = draggedActivityId; draggedActivityId = null; if (id) moveActivity(id, key); });
      column.append(heading, list);
      els.grid.append(column);
    }

    const visible = events.some((event) => {
      const date = parseDate(event.date);
      return date >= weekStart && date <= addDays(weekStart, 6) &&
        (activeFilter === "all" || event.category === activeFilter);
    });
    if (!visible) {
      const empty = document.createElement("div");
      empty.className = "empty-week";
      const title = document.createElement("strong");
      title.textContent = activeFilter === "all" ? "Ta semaine est encore ouverte." : "Aucune activité dans cette catégorie.";
      const message = document.createElement("span");
      message.textContent = activeFilter === "all" ? "Ajoute un premier moment pour commencer à lui donner forme." : "Essaie un autre filtre ou ajoute une activité.";
      empty.append(title, message);
      els.grid.replaceChildren(empty);
    }
  }

  function syncActivityStatusControls() {
    if (els.cancelled.checked) els.completed.checked = false;
    if (els.completed.checked) els.cancelled.checked = false;
    els.completed.disabled = els.cancelled.checked;
    els.cancelled.disabled = els.completed.checked;
  }

  function findOverlaps(record, records) {
    if (record.cancelled || !record.date || !record.start || !record.end || record.end <= record.start) return [];
    return records.filter(other => other.id !== record.id && !other.cancelled && other.date === record.date && record.start < other.end && record.end > other.start);
  }
  function showOverlapWarning() {
    const conflicts = findOverlaps({ id: els.eventId.value, date: els.date.value, start: els.start.value, end: els.end.value, cancelled: els.cancelled.checked }, events);
    const warning = document.querySelector("#activity-overlap"); warning.hidden = !conflicts.length;
    warning.textContent = conflicts.length ? `Chevauchement avec : ${conflicts.map(event => event.title).join(", ")}. Tu peux ajuster les horaires ou confirmer à l’enregistrement.` : "";
  }
  for (const field of [els.date, els.end, els.cancelled]) field.addEventListener("input", showOverlapWarning);
  els.completed.addEventListener("change", showOverlapWarning);
  document.querySelector("#duplicate-event").addEventListener("click", () => {
    els.eventId.value = ""; els.cancelled.checked = false; els.completed.checked = false;
    els.cancelledOption.hidden = true; els.completedOption.hidden = true; els.delete.hidden = true;
    document.querySelector("#duplicate-event").hidden = true;
    els.formTitle.textContent = "Dupliquer l’activité"; syncActivityStatusControls(); showOverlapWarning(); els.date.focus();
  });
  async function moveActivity(id, date) {
    if (movingActivity) return;
    const source = events.find(event => event.id === id); if (!source || source.date === date) return;
    const record = { ...source, date };
    if (findOverlaps(record, events).length && !window.confirm("Ce déplacement crée un chevauchement. Continuer ?")) return;
    const planner = plannerId; movingActivity = true;
    try {
      if (!sharedMode) {
        if (!planner) return;
        const { error } = await supabase.from("activities").upsert(toDatabaseEvent(record)); if (error) throw error;
        if (planner !== plannerId) return;
      }
      events = events.map(event => event.id === id ? record : event);
      if (sharedMode) saveEvents(); render();
      document.querySelector("#planning-message").textContent = "Activité déplacée. Tu peux aussi modifier sa date depuis le formulaire.";
    } catch (error) { if (planner === plannerId) document.querySelector("#planning-message").textContent = errorMessage(error, "Impossible de déplacer l’activité."); }
    finally { movingActivity = false; }
  }
  function stopRealtime() {
    if (realtimeTimer) window.clearTimeout(realtimeTimer);
    realtimeTimer = null; realtimePending.clear();
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  function startRealtime() {
    stopRealtime(); if (!plannerId || sharedMode || typeof supabase.channel !== "function") return;
    const planner = plannerId, user = currentUser?.id;
    const status = document.querySelector("#sync-status"); status.textContent = "Connexion à la synchronisation…";
    function queue(table) {
      if (planner !== plannerId || user !== currentUser?.id) return;
      realtimePending.add(table);
      if (realtimeTimer) window.clearTimeout(realtimeTimer);
      realtimeTimer = window.setTimeout(flush, 400);
    }
    async function flush() {
      realtimeTimer = null;
      if (planner !== plannerId || user !== currentUser?.id) return;
      // Keep in-progress financial and goal forms intact while another device writes.
      const active = document.activeElement;
      if (active?.closest("#salary-form,#expense-form,#bill-form")) { realtimeTimer = window.setTimeout(flush, 1500); return; }
      const tables = new Set(realtimePending); realtimePending.clear();
      try {
        const tasks = [];
        if (tables.has("activities")) tasks.push(loadCloudEvents());
        if (["planner_expenses", "planner_monthly_budgets", "planner_recurring_bills"].some(table => tables.has(table))) tasks.push(loadFinanceData());
        await Promise.all(tasks);
      } catch { status.textContent = "Mise à jour impossible. Recharge pour réessayer."; }
    }
    realtimeChannel = supabase.channel(`planning-${planner}-${user}`);
    for (const table of ["activities", "planner_expenses", "planner_monthly_budgets", "planner_recurring_bills"]) {
      for (const event of ["INSERT", "UPDATE"]) realtimeChannel.on("postgres_changes", { event, schema: "public", table, filter: `planner_id=eq.${planner}` }, () => queue(table));
      // Supabase does not support row filters for DELETE. Refetch only our current planner.
      realtimeChannel.on("postgres_changes", { event: "DELETE", schema: "public", table }, () => queue(table));
    }
    realtimeChannel.subscribe(state => {
      if (planner !== plannerId || user !== currentUser?.id) return;
      if (state === "SUBSCRIBED") { status.textContent = "Synchronisation en direct active."; for (const table of ["activities", "planner_expenses"]) queue(table); }
      else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(state)) status.textContent = "Synchronisation interrompue. Recharge pour réessayer.";
    });
  }
  const themeToggle = document.querySelector("#theme-toggle");
  function renderThemeToggle() {
    const dark = document.documentElement.dataset.theme === "dark";
    themeToggle.textContent = dark ? "Mode clair" : "Mode sombre"; themeToggle.setAttribute("aria-pressed", String(dark));
    document.querySelector('meta[name="theme-color"]').content = dark ? "#15221c" : "#f6f4ec";
  }
  themeToggle.addEventListener("click", () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("semaine.theme", document.documentElement.dataset.theme); } catch { /* Optional preference. */ }
    renderThemeToggle();
  });
  renderThemeToggle();

  function timeAfterStart(start, minutes) {
    if (!/^\d{2}:\d{2}$/.test(start)) return "";
    const [hours, mins] = start.split(":").map(Number);
    if (hours > 23 || mins > 59) return "";
    const total = Math.min(hours * 60 + mins + minutes, 1439);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }
  function updateEndMinimum() {
    els.end.min = timeAfterStart(els.start.value, 1);
  }
  function updateEndFromStart() {
    updateEndMinimum();
    els.end.value = timeAfterStart(els.start.value, 120);
    showOverlapWarning();
  }
  els.start.addEventListener("input", updateEndFromStart);
  els.start.addEventListener("change", updateEndFromStart);

  function resetForm() {
    els.form.reset();
    document.querySelector("#duplicate-event").hidden = true;
    document.querySelector("#activity-overlap").hidden = true;
    els.eventId.value = "";
    els.start.value = "09:00";
    els.end.value = "11:00";
    els.date.value = dateKey(new Date());
    updateEndMinimum();
    els.error.textContent = "";
    els.delete.hidden = true;
    els.cancelled.checked = false;
    els.completed.checked = false;
    els.cancelledOption.hidden = true;
    els.completedOption.hidden = true;
    syncActivityStatusControls();
    els.formTitle.textContent = "Ajouter une activité";
  }

  function openNewForm() {
    resetForm();
    els.dialog.showModal();
    els.pageShell.classList.add("is-event-form-open");
    els.title.focus();
  }

  function openEditForm(event) {
    resetForm();
    els.eventId.value = event.id;
    els.title.value = event.title;
    els.category.value = event.category;
    els.date.value = event.date;
    els.start.value = event.start;
    els.end.value = event.end;
    updateEndMinimum();
    els.location.value = event.location || "";
    els.note.value = event.note || "";
    els.cancelled.checked = event.cancelled === true;
    els.completed.checked = event.completed === true;
    els.cancelledOption.hidden = false;
    els.completedOption.hidden = false;
    syncActivityStatusControls();
    els.delete.hidden = false;
    els.formTitle.textContent = "Modifier l’activité";
    document.querySelector("#duplicate-event").hidden = false;
    showOverlapWarning();
    els.dialog.showModal();
    els.pageShell.classList.add("is-event-form-open");
    els.title.focus();
  }

  function closeForm() {
    els.dialog.close();
    els.error.textContent = "";
  }

  async function handleSubmit(event) {
    event.preventDefault(); els.error.textContent = "";
    if (els.end.value <= els.start.value) { els.error.textContent = "L’heure de fin doit être après l’heure de début."; els.end.focus(); return; }
    const id = els.eventId.value || crypto.randomUUID();
    const record = { id, title: els.title.value.trim(), category: els.category.value, date: els.date.value,
      start: els.start.value, end: els.end.value, location: els.location.value.trim(), note: els.note.value.trim(),
      cancelled: els.cancelled.checked, completed: els.completed.checked };
    if (findOverlaps(record, events).length && !window.confirm("Cette activité chevauche une autre activité. Enregistrer quand même ?")) return;
    if (!record.title || !record.date) { els.error.textContent = "Ajoute un nom et un jour pour cette activité."; return; }
    if (sharedMode) {
      const i = events.findIndex(item => item.id === id); if (i >= 0) events[i] = record; else events.push(record);
      weekStart = mondayOf(parseDate(record.date)); saveEvents(); closeForm(); render(); return;
    }
    if (!plannerId) { els.error.textContent = "Connecte-toi au planning partagé avant d’enregistrer."; return; }
    const saveButton = document.querySelector("#save-event"); saveButton.disabled = true;
    try {
      const { error } = await supabase.from("activities").upsert(toDatabaseEvent(record));
      if (error) throw error;
      const i = events.findIndex(item => item.id === id); if (i >= 0) events[i] = record; else events.push(record);
      clearLegacyCache();
      weekStart = mondayOf(parseDate(record.date)); closeForm(); render();
    } catch (error) { els.error.textContent = errorMessage(error, "L’activité n’a pas pu être enregistrée."); }
    finally { saveButton.disabled = false; }
  }

  document.querySelector("#previous-week").addEventListener("click", () => {
    weekStart = addDays(weekStart, -7);
    render();
  });
  document.querySelector("#next-week").addEventListener("click", () => {
    weekStart = addDays(weekStart, 7);
    render();
  });
  document.querySelector("#current-week").addEventListener("click", () => {
    weekStart = mondayOf(new Date());
    render();
  });
  els.leaveShared.addEventListener("click", leaveSharedCopy);
  document.querySelector("#open-form").addEventListener("click", openNewForm);
  document.querySelector("#close-form").addEventListener("click", closeForm);
  document.querySelector("#cancel-form").addEventListener("click", closeForm);
  els.form.addEventListener("submit", handleSubmit);
  els.cancelled.addEventListener("change", syncActivityStatusControls);
  els.completed.addEventListener("change", syncActivityStatusControls);
  els.financeMonth.value = financeMonth;
  els.financeExpenseDate.value = defaultFinanceDate(financeMonth);
  els.financeMonth.addEventListener("change", () => {
    financeMonth = els.financeMonth.value || dateKey(new Date()).slice(0, 7);
    resetExpenseForm();
    els.financeExpenseDate.value = defaultFinanceDate(financeMonth);
    monthlySalary = null; monthlyExpenses = []; renderFinance();
    loadFinanceData();
  });
  els.financeSalaryForm.addEventListener("submit", saveMonthlySalary);
  els.financeExpenseForm.addEventListener("submit", saveExpense);
  els.dialog.addEventListener("close", () => els.pageShell.classList.remove("is-event-form-open"));
  els.dialog.addEventListener("click", (event) => {
    if (event.target === els.dialog) closeForm();
  });
  els.delete.addEventListener("click", async () => {
    const id = els.eventId.value;
    if (!id || !window.confirm("Supprimer cette activité du planning ?")) return;
    if (sharedMode) { events = events.filter(event => event.id !== id); saveEvents(); closeForm(); render(); return; }
    try {
      const { error } = await supabase.from("activities").delete().eq("id", id).eq("planner_id", plannerId);
      if (error) throw error;
      events = events.filter(event => event.id !== id); closeForm(); render();
    } catch (error) { els.error.textContent = errorMessage(error, "L’activité n’a pas pu être supprimée."); }
  });

  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll(".filter-chip").forEach((chip) => {
        const selected = chip === button;
        chip.classList.toggle("is-active", selected);
        chip.setAttribute("aria-pressed", String(selected));
      });
      renderDays();
    });
  });

  authEls.form.addEventListener("submit", event => { event.preventDefault(); authenticate("signin"); });
  authEls.signIn.addEventListener("click", () => authenticate("signin"));
  authEls.signUp.addEventListener("click", () => authenticate("signup"));
  authEls.signOut.addEventListener("click", async () => { const { error } = await supabase.auth.signOut(); if (error) authEls.message.textContent = errorMessage(error, "La déconnexion a échoué. Réessaie."); });
  authEls.retryPlanner.addEventListener("click", () => currentUser && handleAuthenticated(currentUser, true));
  authEls.importLocal.addEventListener("click", importLocalEvents);
  await bootstrap();
})();