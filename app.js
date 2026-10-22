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
    counts: {
      school: document.querySelector("#school-count"),
      work: document.querySelector("#work-count"),
      spiritual: document.querySelector("#spirit-count"),
      selfcare: document.querySelector("#selfcare-count"),
      sport: document.querySelector("#sport-count"),
      other: document.querySelector("#other-count")
    }
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
  let plannerId = null;
  let currentUser = null;
  let financeMonth = dateKey(new Date()).slice(0, 7);
  let financeRequest = 0;
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
    const rows = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from("activities")
        .select("id,title,category,activity_date,start_time,end_time,location,note,cancelled,completed")
        .eq("planner_id", plannerId).order("activity_date").order("start_time").order("id")
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
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
    els.financeSalary.value = monthlySalary === null ? "" : Number(monthlySalary).toFixed(2);
    els.financeSalaryTotal.textContent = monthlySalary === null ? "À renseigner" : moneyFormat.format(Number(monthlySalary));
    els.financeExpenseTotal.textContent = moneyFormat.format(expensesTotal);
    els.financeRemainder.textContent = monthlySalary === null ? "—" : moneyFormat.format(Number(monthlySalary) - expensesTotal);
    els.financeRemainder.classList.toggle("is-negative", monthlySalary !== null && Number(monthlySalary) - expensesTotal < 0);
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
      row.append(details, amount, remove);
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
    monthlySalary = null;
    monthlyExpenses = [];
    renderFinance();
    els.financeMessage.textContent = "Chargement du suivi financier…";
    els.financeSetup.hidden = true;
    els.financeEmpty.hidden = true;
    els.financeExpenseList.replaceChildren();
    try {
      const [budgetResult, expensesResult] = await Promise.all([
        supabase.from("planner_monthly_budgets").select("salary").eq("planner_id", plannerId).eq("month_start", start).maybeSingle(),
        supabase.from("planner_expenses").select("id,label,amount,expense_date").eq("planner_id", plannerId)
          .gte("expense_date", start).lt("expense_date", end).order("expense_date").order("created_at")
      ]);
      if (!isCurrent()) return;
      if (budgetResult.error) throw budgetResult.error;
      if (expensesResult.error) throw expensesResult.error;
      monthlySalary = budgetResult.data ? Number(budgetResult.data.salary) : null;
      monthlyExpenses = expensesResult.data || [];
      renderFinance();
      els.financeMessage.textContent = "";
    } catch (error) {
      if (!isCurrent()) return;
      els.financeMessage.textContent = error.code === "42501"
        ? "L’accès au suivi financier a été refusé. Vérifie les règles d’accès Supabase."
        : "Impossible de charger le suivi financier. Vérifie ta connexion.";
      els.financeSetup.hidden = !["PGRST205", "42P01"].includes(error.code);
    }
  }
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
      const { error } = await supabase.from("planner_expenses").insert({
        planner_id: plannerId, label, amount, expense_date: expenseDate
      });
      if (error) throw error;
      if (!isCurrent()) return;
      els.financeExpenseLabel.value = "";
      els.financeExpenseAmount.value = "";
      els.financeExpenseDate.value = defaultFinanceDate(financeMonth);
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
    if (error) { plannerId = null; showSetup("Connexion réussie, mais impossible de lire le planning. Vérifie les règles d’accès."); return; }
    if (!memberships?.length) { plannerId = null; showSetup("Ce compte n’est pas encore relié au planning. Une étape de configuration dans Supabase reste à faire."); return; }
    plannerId = memberships[0].planner_id;
    showPlanner();
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
        ++financeRequest; currentUser = null; plannerId = null; events = [];
        monthlySalary = null; monthlyExpenses = []; clearLegacyCache(); showAuth();
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
    renderSummary();
    renderReport();
    renderDays();
  }

  document.querySelectorAll(".mobile-sections a").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      document.querySelector(link.getAttribute("href"))?.scrollIntoView({ block: "start" });
    });
  });

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
    report.message.textContent = (sharedMode ? "Copie partagée : seules les activités présentes dans cette copie sont comptées. " : "") +
      (selected.length ? `${selected.length} activité(s) enregistrée(s). ` : "Aucune activité pour cette période. ") +
      "Taux = accomplies / enregistrées, activités annulées incluses.";
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
      const labels = ["Enregistrées", "Annulées", "Accomplies / exécutées", "Taux d’accomplissement"];
      [...row.querySelectorAll("td")].forEach((cell, index) => {
        const term = document.createElement("dt"); term.textContent = labels[index];
        const value = document.createElement("dd"); value.textContent = cell.textContent;
        list.append(term, value);
      });
      card.append(title, list); report.cards.append(card);
    }
  }

  function renderSummary() {
    const weekEvents = events.filter((event) => {
      const date = parseDate(event.date);
      return date >= weekStart && date <= addDays(weekStart, 6);
    });
    for (const category of Object.keys(categories)) {
      els.counts[category].textContent = weekEvents.filter((event) => event.category === category).length;
    }
  }

  function makeEventCard(event) {
    const card = document.createElement("button");
    card.type = "button";
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

  function resetForm() {
    els.form.reset();
    els.eventId.value = "";
    els.start.value = "09:00";
    els.end.value = "10:00";
    els.date.value = dateKey(weekStart);
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
    els.location.value = event.location || "";
    els.note.value = event.note || "";
    els.cancelled.checked = event.cancelled === true;
    els.completed.checked = event.completed === true;
    els.cancelledOption.hidden = false;
    els.completedOption.hidden = false;
    syncActivityStatusControls();
    els.delete.hidden = false;
    els.formTitle.textContent = "Modifier l’activité";
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