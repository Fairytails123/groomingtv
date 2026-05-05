/* Breed working screen — single-screen, D-pad-driven, no scroll.
 *
 * The pack's sections (Body / Throat / Tail / Legs / Head / …) are
 * shown one at a time via a section pager. Vision-finding sections
 * (auto-extracted handwritten annotations) are hidden — they're
 * admin-review material, not at-a-glance reference for groomers.
 *
 * Image pane: main diagram + a single horizontal thumb row, capped at
 * THUMB_LIMIT items. No vertical stacking, no scroll.
 *
 * Important notes (display.show_warnings) become a footer strip that
 * stays visible regardless of which section is active.
 */

import { fetchBreedPack } from "../api.js";
import { wireDpadNav, focusFirst } from "../nav.js";
import { openSearch } from "../search.js";

const THUMB_LIMIT = 6;
const ROLE_ORDER  = ["front", "back", "head", "supplementary"];
const VISION_RX   = /^Vision findings/i;

const els = {
  title:        () => document.getElementById("breed-title"),
  groomToggle:  () => document.getElementById("groom-toggle"),
  backBtn:      () => document.getElementById("back-btn"),
  refreshBtn:   () => document.getElementById("refresh-btn"),
  searchBtn:    () => document.getElementById("search-btn"),
  pager:        () => document.getElementById("section-pager"),
  stage:        () => document.getElementById("breed-stage"),
  imagePane:    () => document.getElementById("image-pane"),
  textPane:     () => document.getElementById("text-pane"),
  warning:      () => document.getElementById("warning-strip"),
  loading:      () => document.getElementById("loading"),
  empty:        () => document.getElementById("empty-state"),
};

let state = {
  slug: null,
  pack: null,
  profileId: null,
  sectionIdx: 0,
};

function init() {
  const params = new URLSearchParams(window.location.search);
  state.slug = params.get("slug");
  state.profileId = params.get("profile") || null;

  wireDpadNav({ onBack: goHome });
  els.backBtn().addEventListener("click", goHome);
  els.refreshBtn().addEventListener("click", load);
  els.searchBtn().addEventListener("click", () => openSearch());

  if (!state.slug) {
    showEmpty("No breed selected", "Open Search to find a breed.");
    return;
  }
  load();
}

function goHome() {
  window.location.href = "index.html";
}

async function load() {
  els.loading().classList.remove("tv-hidden");
  els.empty().classList.add("tv-hidden");
  els.stage().classList.add("tv-hidden");
  els.pager().classList.add("tv-hidden");
  els.warning().classList.add("tv-hidden");
  try {
    state.pack = await fetchBreedPack(state.slug);
    if (!state.profileId || !state.pack.profiles[state.profileId]) {
      state.profileId = state.pack.default_profile_id;
    }
    state.sectionIdx = 0;
    render();
  } catch (err) {
    console.error("[breed] fetch failed", err);
    if (err.status === 404) {
      showEmpty("Not in knowledge base yet",
        `No published profile for "${state.slug}". Try Search for a similar breed.`);
    } else {
      showEmpty("Couldn't reach the back end",
        "Check the salon wifi and tap Refresh.");
    }
  } finally {
    els.loading().classList.add("tv-hidden");
  }
}

function showEmpty(title, body) {
  els.empty().classList.remove("tv-hidden");
  els.empty().querySelector(".tv-empty__title").textContent = title;
  els.empty().querySelector(".tv-empty__body").textContent = body;
  focusFirst();
}

function render() {
  const pack = state.pack;
  const profile = pack.profiles[state.profileId];
  if (!profile) {
    showEmpty("Profile missing", "This breed has no published profile yet.");
    return;
  }
  els.stage().classList.remove("tv-hidden");
  els.title().textContent = pack.breed_name;

  /* Apply per-profile display ratio; clamp into [40, 60] so the text
     pane always has enough width to fit the longest core section
     (~190 words for the Mini Schnauzer Body) without scroll. */
  const imgPanel = clamp(Number(profile.display?.image_panel_width ?? 55), 40, 60);
  const txtPanel = 100 - imgPanel;
  els.stage().style.gridTemplateColumns = `${imgPanel}fr ${txtPanel}fr`;

  renderGroomToggle(pack);
  renderImagePane(profile);
  renderSectionPager(profile);
  renderActiveSection(profile);
  renderWarning(profile);
  /* Focus the active section chip so D-pad arrow keys move sideways
     between sections rather than into the topbar. */
  focusActiveChip();
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function renderGroomToggle(pack) {
  const wrap = els.groomToggle();
  wrap.innerHTML = "";
  const profileIds = Object.keys(pack.profiles);
  if (profileIds.length < 2) {
    wrap.classList.add("tv-hidden");
    return;
  }
  wrap.classList.remove("tv-hidden");
  for (const pid of profileIds) {
    const p = pack.profiles[pid];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.profile = pid;
    btn.textContent = p.groom_type;
    btn.setAttribute("aria-pressed", String(pid === state.profileId));
    btn.addEventListener("click", () => {
      state.profileId = pid;
      state.sectionIdx = 0;
      const url = new URL(window.location.href);
      url.searchParams.set("profile", pid);
      history.replaceState({}, "", url);
      render();
    });
    wrap.appendChild(btn);
  }
}

function visibleSections(profile) {
  return (profile.sections ?? [])
    .filter((s) => !VISION_RX.test(s.name ?? ""))
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function renderSectionPager(profile) {
  const sections = visibleSections(profile);
  const pager = els.pager();
  pager.innerHTML = "";
  if (!sections.length) {
    pager.classList.add("tv-hidden");
    return;
  }
  pager.classList.remove("tv-hidden");
  sections.forEach((sec, idx) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "section-chip";
    chip.role = "tab";
    chip.textContent = shortenName(sec.name);
    chip.setAttribute("aria-selected", String(idx === state.sectionIdx));
    chip.dataset.idx = String(idx);
    chip.addEventListener("click", () => {
      state.sectionIdx = idx;
      renderActiveSection(profile);
      updateChipSelection();
      chip.focus();
    });
    pager.appendChild(chip);
  });
}

function shortenName(name) {
  /* Section names from the data are sentence-style; trim to the most
     useful ~14 chars so chips fit in a row of 5-7 across 1920 px. */
  if (!name) return "Section";
  const map = {
    "Throat and chest":     "Throat",
    "Carriage and tail end":"Tail",
    "Legs and feet":        "Legs",
    "Head/ears/brows":      "Head",
  };
  if (map[name]) return map[name];
  return name.length > 14 ? name.slice(0, 13) + "…" : name;
}

function updateChipSelection() {
  for (const chip of els.pager().querySelectorAll(".section-chip")) {
    chip.setAttribute("aria-selected",
      String(Number(chip.dataset.idx) === state.sectionIdx));
  }
}

function focusActiveChip() {
  const active = els.pager()
    .querySelector(`.section-chip[data-idx="${state.sectionIdx}"]`);
  active?.focus();
}

function renderActiveSection(profile) {
  const sections = visibleSections(profile);
  if (!sections.length) {
    els.textPane().innerHTML =
      `<div class="tv-empty"><div class="tv-empty__title">No sections yet</div></div>`;
    return;
  }
  if (state.sectionIdx >= sections.length) state.sectionIdx = 0;
  const sec = sections[state.sectionIdx];
  const pane = els.textPane();
  pane.innerHTML = "";

  const name = document.createElement("div");
  name.className = "text-pane__name";
  name.textContent = sec.name ?? "Section";
  pane.appendChild(name);

  const bladeRow = document.createElement("div");
  bladeRow.className = "text-pane__blades";
  /* Prefer per-section blade list; fall back to profile-wide if empty. */
  const blades = (sec.blade_numbers?.length
    ? sec.blade_numbers
    : profile.blade_numbers ?? []);
  if (blades.length) {
    for (const b of blades) {
      const pill = document.createElement("span");
      pill.className = "blade-pill";
      pill.textContent = b;
      bladeRow.appendChild(pill);
    }
  }
  pane.appendChild(bladeRow);

  const body = document.createElement("div");
  body.className = "text-pane__body";
  body.textContent = sec.text ?? "";
  pane.appendChild(body);
}

function renderImagePane(profile) {
  const pane = els.imagePane();
  pane.innerHTML = "";

  /* Main image */
  const main = document.createElement("div");
  main.className = "image-main";
  if (profile.images?.main?.url) {
    const img = document.createElement("img");
    img.src = profile.images.main.url;
    img.alt = `${profile.groom_type} main image`;
    img.loading = "eager";
    main.appendChild(img);
  } else {
    main.innerHTML = `<div class="tv-empty"><div class="tv-empty__body">No main image yet</div></div>`;
  }
  pane.appendChild(main);

  /* Thumbnail row — one row, capped at THUMB_LIMIT, role label as overlay. */
  const supplementary = profile.images?.supplementary ?? [];
  if (supplementary.length) {
    const sorted = supplementary.slice().sort((a, b) =>
      ROLE_ORDER.indexOf(a.role || "supplementary")
      - ROLE_ORDER.indexOf(b.role || "supplementary"));
    const visible = sorted.slice(0, THUMB_LIMIT);
    const row = document.createElement("div");
    row.className = "image-thumb-row";
    for (const t of visible) {
      const cell = document.createElement("div");
      cell.className = "image-thumb";
      const role = t.role || "supplementary";
      cell.innerHTML = `
        <span class="image-thumb__role">${humanRoleShort(role)}</span>
        <img src="${escapeAttr(t.url)}" alt="${escapeAttr(role)} reference" loading="lazy">`;
      row.appendChild(cell);
    }
    pane.appendChild(row);
  }
}

function humanRoleShort(role) {
  return role === "supplementary" ? "Other"
       : role.charAt(0).toUpperCase() + role.slice(1);
}

function renderWarning(profile) {
  const warn = els.warning();
  if (profile.display?.show_warnings === false || !profile.important_notes?.trim()) {
    warn.classList.add("tv-hidden");
    return;
  }
  warn.classList.remove("tv-hidden");
  warn.innerHTML = `
    <span class="warning-strip__title">Important</span>${escapeHtml(profile.important_notes)}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
function escapeAttr(s) { return escapeHtml(s); }

init();
