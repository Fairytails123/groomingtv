/* Start screen — today's bookings as breed buttons. */

import { fetchToday } from "../api.js";
import { wireDpadNav, focusFirst } from "../nav.js";
import { openSearch } from "../search.js";

const VISIBLE_CAP = 9;   /* 3×3 grid; extras live behind Search. */

const els = {
  pageTitle:    () => document.getElementById("page-title"),
  meta:         () => document.getElementById("page-meta"),
  filter:       () => document.getElementById("session-filter"),
  refreshBtn:   () => document.getElementById("refresh-btn"),
  searchBtn:    () => document.getElementById("search-btn"),
  grid:         () => document.getElementById("breed-grid"),
  empty:        () => document.getElementById("empty-state"),
  loading:      () => document.getElementById("loading"),
  overflow:     () => document.getElementById("overflow-note"),
};

let state = {
  pack: null,
  filter: "all", // "am" | "pm" | "all"
};

function init() {
  wireDpadNav({ onBack: () => { /* already on start screen */ } });
  els.refreshBtn().addEventListener("click", load);
  els.searchBtn().addEventListener("click", () => openSearch());
  els.filter().querySelectorAll("button[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => setFilter(btn.dataset.filter));
  });
  load();
}

function setFilter(value) {
  state.filter = value;
  els.filter().querySelectorAll("button[data-filter]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.filter === value));
  });
  render();
}

async function load() {
  els.loading().classList.remove("tv-hidden");
  els.grid().innerHTML = "";
  els.empty().classList.add("tv-hidden");
  try {
    state.pack = await fetchToday();
    render();
  } catch (err) {
    console.error("[start] fetchToday failed", err);
    els.grid().innerHTML = "";
    els.empty().classList.remove("tv-hidden");
    els.empty().querySelector(".tv-empty__title").textContent = "Couldn't reach the back end";
    els.empty().querySelector(".tv-empty__body").textContent = "Check the salon wifi and tap Refresh.";
  } finally {
    els.loading().classList.add("tv-hidden");
  }
}

function render() {
  const pack = state.pack;
  if (!pack) return;
  els.pageTitle().textContent = formatHeader(pack.session_date);
  els.meta().textContent = `Updated ${formatTime(pack.generated_at)}`;

  const bookings = (pack.bookings ?? []).filter((b) => filterMatches(b, state.filter));
  els.grid().innerHTML = "";

  if (!bookings.length) {
    els.empty().classList.remove("tv-hidden");
    els.overflow().classList.add("tv-hidden");
    const t = pack.bookings?.length
      ? `No ${state.filter.toUpperCase()} grooms today`
      : "No grooms today";
    els.empty().querySelector(".tv-empty__title").textContent = t;
    els.empty().querySelector(".tv-empty__body").textContent =
      "Open Search to look up any breed in the knowledge base.";
    focusFirst();
    return;
  }
  els.empty().classList.add("tv-hidden");

  /* Cap to VISIBLE_CAP; overflow surfaces via Search. */
  const visible = bookings.slice(0, VISIBLE_CAP);
  const hidden  = bookings.length - visible.length;
  for (const booking of visible) els.grid().appendChild(renderCard(booking));

  const overflowEl = els.overflow();
  if (hidden > 0) {
    overflowEl.classList.remove("tv-hidden");
    overflowEl.textContent = `+${hidden} more — use Search`;
  } else {
    overflowEl.classList.add("tv-hidden");
  }

  focusFirst();
}

function filterMatches(booking, filter) {
  if (filter === "all") return true;
  const dt = booking.appointment_datetime;
  if (!dt) return filter === "all";
  const hour = new Date(dt).getHours();
  if (filter === "am") return hour < 12;
  if (filter === "pm") return hour >= 12;
  return true;
}

function renderCard(booking) {
  const card = document.createElement("button");
  card.className = "breed-card";
  card.type = "button";

  const time = booking.appointment_datetime
    ? new Date(booking.appointment_datetime).toLocaleTimeString("en-GB", {
        hour: "2-digit", minute: "2-digit",
      })
    : "—:—";

  const name = booking.matched
    ? escapeHtml(toTitle(booking.breed_slug ?? booking.raw_breed))
    : escapeHtml(booking.raw_breed || "Unknown breed");
  const sub = booking.matched ? "" : `<div class="breed-card__raw">"${escapeHtml(booking.raw_breed)}"</div>`;
  const status = booking.matched
    ? `<span class="tv-pill tv-pill--success">Matched</span>`
    : `<span class="tv-pill tv-pill--warning">Not in KB</span>`;

  card.innerHTML = `
    <div class="breed-card__main">
      <div class="breed-card__name">${name}</div>
      <div class="breed-card__time">${escapeHtml(time)} · ${escapeHtml(booking.appointment_type ?? "")}</div>
      ${sub}
    </div>
    <div class="breed-card__status">${status}</div>`;

  if (booking.matched && booking.breed_slug) {
    card.addEventListener("click", () => {
      window.location.href = `breed.html?slug=${encodeURIComponent(booking.breed_slug)}`;
    });
  } else {
    /* Unmatched booking — show suggestions inline if any. */
    if (booking.fallback?.suggested_breed_ids?.length) {
      const suggestions = document.createElement("div");
      suggestions.className = "tv-suggestions";
      suggestions.innerHTML = `<div class="tv-suggestions__title">Suggested matches</div>`;
      for (const id of booking.fallback.suggested_breed_ids) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "tv-suggestions__row";
        row.textContent = id; // Will resolve to slug via search modal if needed.
        suggestions.appendChild(row);
      }
      card.querySelector(".breed-card__main").appendChild(suggestions);
    }
    card.addEventListener("click", () => openSearch());
  }
  return card;
}

function toTitle(slug) {
  return String(slug ?? "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatHeader(iso) {
  if (!iso) return "Today";
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function formatTime(iso) {
  if (!iso) return "—:—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit",
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

init();
