import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

(async () => {
  "use strict";

  const STORAGE_KEY = "semaine-en-equilibre.events.v1";
  const supabase = createClient("https://vlmnyhuirtczgjrbonlxl.supabase.co", "sb_publishable_4BgM1XswECgt8rYElCyCcQ_yUvIEtHl");
  const categories = {
    school: { label: "École", className: "school" },
    work: { label: "Travail", className: "work" },
    spiritual: { label: "Spirituel", className: "spiritual" },
    sport: { label: "Sport", className: "sport" },
    other: { label: "Autre activité", className: "other" }
  };
  const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  const els = {
    weekLabel: document.querySelector("#week-label"),
    grid: document.querySelector("#week-grid"),
    dialog: document.querySelector("#event-dialog"),
    shareOutput: document.querySelector("#share-output"),
    shareLink: document.querySelector("#share-link"),
    shareMessage: document.querySelector("#share-message"),
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
    error: document.querySelector("#form-error"),
    delete: document.querySelector("#delete-event"),
    counts: {
      school: document.querySelector("#school-count"),
      work: document.querySelector("#work-count"),
      spiritual: document.querySelector("#spirit-count"),
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
  const localEvents = sharedSnapshot ? [] : loadEvents();
  let events = sharedSnapshot ? loadEvents(sharedDraftKey, sharedSnapshot.events) : [...localEvents];
  let weekStart = sharedSnapshot ? parseDate(sharedSnapshot.week) : mondayOf(new Date());
  let activeFilter = "all";
  let plannerId = null;
  let currentUser = null;

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
  }
  function toDatabaseEvent(event) {
    return { id: event.id, planner_id: plannerId, title: event.title, category: event.category,
      activity_date: event.date, start_time: event.start, end_time: event.end,
      location: event.location || null, note: event.note || null };
  }
  function fromDatabaseEvent(row) {
    return { id: row.id, title: row.title, category: row.category, date: row.activity_date,
      start: String(row.start_time).slice(0, 5), end: String(row.end_time).slice(0, 5),
      location: row.location || "", note: row.note || "" };
  }
  async function loadCloudEvents() {
    const { data, error } = await supabase.from("activities")
      .select("id,title,category,activity_date,start_time,end_time,location,note")
      .eq("planner_id", plannerId).order("activity_date").order("start_time");
    if (error) throw error;
    events = (data || []).map(fromDatabaseEvent);
    authEls.migrationPanel.hidden = !(events.length === 0 && localEvents.length > 0);
    render();
  }
  async function handleAuthenticated(user, force = false) {
    if (!user || (!force && currentUser?.id === user.id && plannerId)) return;
    currentUser = user;
    const { data: memberships, error } = await supabase.from("planner_members").select("planner_id,role").limit(1);
    if (error) { plannerId = null; showSetup("Connexion réussie, mais impossible de lire le planning. Vérifie les règles d’accès."); return; }
    if (!memberships?.length) { plannerId = null; showSetup("Ce compte n’est pas encore relié au planning. Une étape de configuration dans Supabase reste à faire."); return; }
    plannerId = memberships[0].planner_id;
    showPlanner();
    try { await loadCloudEvents(); }
    catch (error) {
      authEls.setupMessage.textContent = error.message || "Impossible de charger les activités.";
      authEls.setupPanel.hidden = false; authEls.plannerApp.hidden = true; els.storageLabel.textContent = "Erreur de synchronisation";
    }
  }
  async function bootstrap() {
    if (sharedMode) { showPlanner(); render(); return; }
    const { data, error } = await supabase.auth.getSession();
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { currentUser = null; plannerId = null; showAuth(); }
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
    } catch (error) { authEls.message.textContent = error.message || "La connexion a échoué."; }
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
    } catch (error) { authEls.setupMessage.textContent = error.message || "L’import a échoué."; }
    finally { authEls.importLocal.disabled = false; }
  }

  function loadEvents(storageKey = STORAGE_KEY, fallback = []) {
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw === null ? fallback : JSON.parse(raw);
      if (!Array.isArray(saved)) return [];
      return saved
        .map((event) => event?.category === "travel" ? { ...event, category: "other" } : event)
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
        els.shareOutput.hidden = true;
        els.shareNotice.textContent = "Tes changements restent dans cette copie sur cet appareil. Crée un nouveau lien pour les transmettre.";
      }
    } catch {
      els.error.textContent = "Le navigateur n’a pas pu enregistrer les changements.";
    }
  }

  function buildShareUrl() {
    const weekEnd = addDays(weekStart, 6);
    const weekEvents = events.filter((event) => {
      const date = parseDate(event.date);
      return date >= weekStart && date <= weekEnd;
    });
    const payload = {
      version: 1,
      week: dateKey(weekStart),
      events: weekEvents
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    return `${location.origin}${location.pathname}#share=${encoded}`;
  }

  async function shareWeek() {
    const url = buildShareUrl();
    if (url.length > 8000) {
      els.shareMessage.textContent = "Le lien est trop long. Retire les notes et lieux facultatifs avant de partager.";
      els.shareOutput.hidden = false;
      els.shareLink.value = "";
      return;
    }
    els.shareLink.value = url;
    els.shareOutput.hidden = false;
    try {
      await navigator.clipboard.writeText(url);
      els.shareMessage.textContent = "Lien copié. Envoie-le en privé à la personne avec qui tu partages cette semaine.";
    } catch {
      els.shareMessage.textContent = "Copie ce lien et envoie-le en privé. Toute personne qui le reçoit peut voir la semaine.";
      els.shareLink.focus();
      els.shareLink.select();
    }
  }

  async function copyShareLink() {
    if (!els.shareLink.value) return;
    try {
      await navigator.clipboard.writeText(els.shareLink.value);
      els.shareMessage.textContent = "Lien copié. Envoie-le en privé.";
    } catch {
      els.shareLink.focus();
      els.shareLink.select();
      els.shareMessage.textContent = "Sélectionne le lien, puis copie-le.";
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
    renderDays();
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
    card.className = `event-card category-${categories[event.category].className}`;
    card.setAttribute("aria-label", `${categories[event.category].label}, ${event.title}, ${event.start} à ${event.end}. Modifier`);
    card.addEventListener("click", () => openEditForm(event));

    const time = document.createElement("span");
    time.className = "event-time";
    time.textContent = `${event.start} – ${event.end}`;
    const title = document.createElement("span");
    title.className = "event-title";
    title.textContent = event.title;
    card.append(time, title);

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

  function resetForm() {
    els.form.reset();
    els.eventId.value = "";
    els.start.value = "09:00";
    els.end.value = "10:00";
    els.date.value = dateKey(weekStart);
    els.error.textContent = "";
    els.delete.hidden = true;
    els.formTitle.textContent = "Ajouter une activité";
  }

  function openNewForm() {
    resetForm();
    els.dialog.showModal();
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
    els.delete.hidden = false;
    els.formTitle.textContent = "Modifier l’activité";
    els.dialog.showModal();
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
      start: els.start.value, end: els.end.value, location: els.location.value.trim(), note: els.note.value.trim() };
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
      weekStart = mondayOf(parseDate(record.date)); closeForm(); render();
    } catch (error) { els.error.textContent = error.message || "L’activité n’a pas pu être enregistrée."; }
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
  document.querySelector("#share-week").addEventListener("click", shareWeek);
  document.querySelector("#copy-share-link").addEventListener("click", copyShareLink);
  document.querySelector("#open-form").addEventListener("click", openNewForm);
  document.querySelector("#close-form").addEventListener("click", closeForm);
  document.querySelector("#cancel-form").addEventListener("click", closeForm);
  els.form.addEventListener("submit", handleSubmit);
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
    } catch (error) { els.error.textContent = error.message || "L’activité n’a pas pu être supprimée."; }
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
  authEls.signOut.addEventListener("click", async () => { const { error } = await supabase.auth.signOut(); if (error) authEls.message.textContent = error.message; });
  authEls.retryPlanner.addEventListener("click", () => currentUser && handleAuthenticated(currentUser, true));
  authEls.importLocal.addEventListener("click", importLocalEvents);
  await bootstrap();
})();