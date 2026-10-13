(() => {
  "use strict";

  const STORAGE_KEY = "semaine-en-equilibre.events.v1";
  const categories = {
    school: { label: "École", className: "school" },
    travel: { label: "Voyage", className: "travel" },
    spiritual: { label: "Spirituel", className: "spiritual" },
    sport: { label: "Sport", className: "sport" },
    work: { label: "Travail", className: "work" }
  };
  const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  const els = {
    weekLabel: document.querySelector("#week-label"),
    grid: document.querySelector("#week-grid"),
    dialog: document.querySelector("#event-dialog"),
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
      travel: document.querySelector("#travel-count"),
      spiritual: document.querySelector("#spirit-count"),
      sport: document.querySelector("#sport-count"),
      work: document.querySelector("#work-count")
    }
  };

  let events = loadEvents();
  let weekStart = mondayOf(new Date());
  let activeFilter = "all";

  function loadEvents() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter(isValidEvent) : [];
    } catch {
      return [];
    }
  }

  function isValidEvent(event) {
    return event && typeof event.id === "string" &&
      typeof event.title === "string" && typeof event.date === "string" &&
      Object.hasOwn(categories, event.category);
  }

  function saveEvents() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {
      els.error.textContent = "Le navigateur n’a pas pu enregistrer les changements.";
    }
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

  function handleSubmit(event) {
    event.preventDefault();
    els.error.textContent = "";

    if (els.end.value <= els.start.value) {
      els.error.textContent = "L’heure de fin doit être après l’heure de début.";
      els.end.focus();
      return;
    }

    const id = els.eventId.value || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    const record = {
      id,
      title: els.title.value.trim(),
      category: els.category.value,
      date: els.date.value,
      start: els.start.value,
      end: els.end.value,
      location: els.location.value.trim(),
      note: els.note.value.trim()
    };

    if (!record.title || !record.date) {
      els.error.textContent = "Ajoute un nom et un jour pour cette activité.";
      return;
    }

    const existingIndex = events.findIndex((item) => item.id === id);
    if (existingIndex >= 0) events[existingIndex] = record;
    else events.push(record);

    weekStart = mondayOf(parseDate(record.date));
    saveEvents();
    closeForm();
    render();
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
  document.querySelector("#open-form").addEventListener("click", openNewForm);
  document.querySelector("#close-form").addEventListener("click", closeForm);
  document.querySelector("#cancel-form").addEventListener("click", closeForm);
  els.form.addEventListener("submit", handleSubmit);
  els.dialog.addEventListener("click", (event) => {
    if (event.target === els.dialog) closeForm();
  });
  els.delete.addEventListener("click", () => {
    const id = els.eventId.value;
    if (!id || !window.confirm("Supprimer cette activité du planning ?")) return;
    events = events.filter((event) => event.id !== id);
    saveEvents();
    closeForm();
    render();
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

  render();
})();