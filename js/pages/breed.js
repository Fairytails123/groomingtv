/* Breed working screen — TV redesign (Apple-inspired, 1920×1080, no scroll).
 *
 * Same behavioral contract as the previous breed.js:
 *   - Reads ?slug= and optional ?profile= from the URL.
 *   - Fetches the per-breed pack from the back-end PWA.
 *   - Renders one section at a time via a section pager.
 *   - Hides Vision-finding sections (admin-review only).
 *   - Honors profile.display.show_warnings + profile.display.image_panel_width.
 *
 * What's new vs. the previous renderer:
 *   - Apple-leaning chrome: floating cards, soft shadows, generous radii,
 *     translucent topbar, pill-style segmented controls.
 *   - Bottom thumbnail strip is now interactive — clicking a thumb swaps it
 *     into the main image with a soft cross-fade. The main image is part of
 *     the same image set; index 0 is the breed pack's `images.main` and
 *     1..n are `images.supplementary` in role order.
 *   - D-pad arrows move sideways through thumbs (←/→) and through sections
 *     (↑/↓) so the screen never relies on scroll.
 */

import { fetchBreedPack } from "../api.js";
import { wireDpadNav, focusFirst } from "../nav.js";
import { openSearch } from "../search.js";

const THUMB_LIMIT = 6;
const ROLE_ORDER  = ["front", "back", "head", "supplementary"];
const VISION_RX   = /^Vision findings/i;
const ROLE_LABELS = {
  main: "Main", front: "Front", back: "Back",
  head: "Head", supplementary: "Other",
};

const $ = (id) => document.getElementById(id);

const els = {
  page:        () => $("page"),
  title:       () => $("breed-title"),
  titleMeta:   () => $("title-meta"),
  groomToggle: () => $("groom-toggle"),
  backBtn:     () => $("back-btn"),
  refreshBtn:  () => $("refresh-btn"),
  searchBtn:   () => $("search-btn"),
  pager:       () => $("pager"),
  imgCol:      () => $("imgcol"),
  mainImg:     () => $("main-img"),
  mainInner:   () => $("main-img-inner"),
  mainChip:    () => $("main-img-chip-label"),
  strip:       () => $("strip"),
  textPane:    () => $("textpane"),
  textName:    () => $("text-name"),
  textEyebrow: () => $("text-eyebrow"),
  blades:      () => $("blades"),
  textBody:    () => $("text-body"),
  warn:        () => $("warn"),
  warnBody:    () => $("warn-body"),
  loading:     () => $("loading"),
  empty:       () => $("empty-state"),
};

const state = {
  slug:       null,
  pack:       null,
  profileId:  null,
  sectionIdx: 0,
  imageIdx:   0,    // 0 = main, 1..n = supplementary in role order
};

function init() {
  const params = new URLSearchParams(window.location.search);
  state.slug      = params.get("slug");
  state.profileId = params.get("profile") || null;

  wireDpadNav({ onBack: goHome });
  els.backBtn().addEventListener("click", goHome);
  els.refreshBtn().addEventListener("click", load);
  els.searchBtn().addEventListener("click", () => openSearch());

  /* Local D-pad: ←/→ between thumbs, ↑/↓ between sections.
     wireDpadNav() handles roving focus across the whole page; this is
     additive so groomers can scrub the image set without leaving focus
     on the strip. */
  window.addEventListener("keydown", onKey);

  if (!state.slug) {
    showEmpty("No breed selected", "Open Search to find a breed.");
    return;
  }
  load();
}

function goHome() { window.location.href = "index.html"; }

async function load() {
  els.loading().classList.remove("hidden");
  els.empty().classList.add("hidden");
  els.imgCol().classList.add("hidden");
  els.textPane().classList.add("hidden");
  els.pager().classList.add("hidden");
  els.warn().classList.add("hidden");
  try {
    state.pack = await fetchBreedPack(state.slug);
    if (!state.profileId || !state.pack.profiles[state.profileId]) {
      state.profileId = state.pack.default_profile_id;
    }
    state.sectionIdx = 0;
    state.imageIdx   = 0;
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
    els.loading().classList.add("hidden");
  }
}

function showEmpty(title, body) {
  const e = els.empty();
  e.classList.remove("hidden");
  e.querySelector(".tv-empty__title").textContent = title;
  e.querySelector(".tv-empty__body").textContent  = body;
  focusFirst();
}

function render() {
  const pack = state.pack;
  const profile = pack.profiles[state.profileId];
  if (!profile) {
    showEmpty("Profile missing", "This breed has no published profile yet.");
    return;
  }
  els.imgCol().classList.remove("hidden");
  els.textPane().classList.remove("hidden");
  els.title().textContent = pack.breed_name;
  els.titleMeta().textContent = profile.groom_type || "";

  /* Apply per-profile image-panel width via CSS grid columns on the stage.
     Clamp into [40, 60] same as the previous renderer. */
  const imgPanel = clamp(Number(profile.display?.image_panel_width ?? 56), 40, 60);
  const txtPanel = 100 - imgPanel;
  document.querySelector(".stage").style.gridTemplateColumns =
    `${imgPanel}fr ${txtPanel}fr`;

  renderGroomToggle(pack);
  renderImages(profile);
  renderPager(profile);
  renderSection(profile);
  renderWarning(profile);
  focusActiveChip();
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

/* ── Groom toggle ────────────────────────────────────────── */
function renderGroomToggle(pack) {
  const wrap = els.groomToggle();
  wrap.innerHTML = "";
  const ids = Object.keys(pack.profiles);
  if (ids.length < 2) { wrap.classList.add("hidden"); return; }
  wrap.classList.remove("hidden");
  for (const pid of ids) {
    const p = pack.profiles[pid];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.profile = pid;
    btn.textContent = p.groom_type;
    btn.setAttribute("aria-pressed", String(pid === state.profileId));
    btn.addEventListener("click", () => {
      state.profileId  = pid;
      state.sectionIdx = 0;
      state.imageIdx   = 0;
      const url = new URL(window.location.href);
      url.searchParams.set("profile", pid);
      history.replaceState({}, "", url);
      render();
    });
    wrap.appendChild(btn);
  }
}

/* ── Images (main + bottom strip) ────────────────────────── */
function imageList(profile) {
  const out = [];
  if (profile.images?.main?.url) {
    out.push({ ...profile.images.main, role: "main" });
  }
  const supp = (profile.images?.supplementary ?? [])
    .slice()
    .sort((a, b) =>
      ROLE_ORDER.indexOf(a.role || "supplementary")
      - ROLE_ORDER.indexOf(b.role || "supplementary"));
  /* Cap the strip including the main thumb. THUMB_LIMIT counts
     supplementary slots, matching the previous renderer's contract. */
  for (const t of supp.slice(0, THUMB_LIMIT)) out.push(t);
  return out;
}

function renderImages(profile) {
  const imgs = imageList(profile);
  if (state.imageIdx >= imgs.length) state.imageIdx = 0;

  /* Main */
  swapMain(imgs[state.imageIdx], profile);

  /* Strip */
  const strip = els.strip();
  strip.innerHTML = "";
  imgs.forEach((it, idx) => {
    const t = document.createElement("button");
    t.type = "button";
    t.className = "thumb";
    t.setAttribute("role", "option");
    t.setAttribute("aria-current", String(idx === state.imageIdx));
    t.dataset.idx = String(idx);
    t.innerHTML = `
      <span class="thumb__bg" aria-hidden="true"></span>
      <img src="${escapeAttr(it.url)}" alt="${escapeAttr(it.role || "image")}" loading="lazy">
      <span class="thumb__role">${escapeHtml(roleLabel(it))}</span>`;
    t.addEventListener("click", () => selectImage(idx));
    strip.appendChild(t);
  });
}

function selectImage(idx) {
  if (idx === state.imageIdx) return;
  const profile = state.pack.profiles[state.profileId];
  const imgs = imageList(profile);
  if (idx < 0 || idx >= imgs.length) return;
  state.imageIdx = idx;
  for (const el of els.strip().querySelectorAll(".thumb")) {
    el.setAttribute("aria-current", String(Number(el.dataset.idx) === idx));
  }
  swapMain(imgs[idx], profile);
}

function swapMain(item, profile) {
  if (!item) return;
  const inner = els.mainInner();
  inner.style.opacity = "0";
  setTimeout(() => {
    inner.innerHTML = "";
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = `${profile.groom_type} ${item.role || "image"}`;
    img.loading = "eager";
    inner.appendChild(img);
    inner.style.opacity = "1";
    els.mainChip().textContent = roleLabel(item);
  }, 180);
}

function roleLabel(item) {
  return item.label || ROLE_LABELS[item.role] || "View";
}

/* ── Sections ────────────────────────────────────────────── */
function visibleSections(profile) {
  return (profile.sections ?? [])
    .filter((s) => !VISION_RX.test(s.name ?? ""))
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function renderPager(profile) {
  const sections = visibleSections(profile);
  const pager = els.pager();
  pager.innerHTML = "";
  if (!sections.length) { pager.classList.add("hidden"); return; }
  pager.classList.remove("hidden");
  sections.forEach((sec, idx) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "section-chip";
    chip.setAttribute("role", "tab");
    chip.setAttribute("aria-selected", String(idx === state.sectionIdx));
    chip.dataset.idx = String(idx);
    chip.innerHTML =
      `<span class="num">${String(idx + 1).padStart(2, "0")}</span>` +
      `<span>${escapeHtml(shortName(sec.name))}</span>`;
    chip.addEventListener("click", () => {
      state.sectionIdx = idx;
      renderSection(profile);
      updateChipSelection();
      chip.focus();
    });
    pager.appendChild(chip);
  });
}

function shortName(name) {
  if (!name) return "Section";
  const map = {
    "Throat and chest":      "Throat",
    "Carriage and tail end": "Tail",
    "Legs and feet":         "Legs",
    "Head/ears/brows":       "Head",
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
  els.pager()
    .querySelector(`.section-chip[data-idx="${state.sectionIdx}"]`)
    ?.focus();
}

function renderSection(profile) {
  const sections = visibleSections(profile);
  if (!sections.length) {
    els.textName().textContent = "";
    els.textBody().textContent = "No sections published yet.";
    els.blades().innerHTML = "";
    return;
  }
  if (state.sectionIdx >= sections.length) state.sectionIdx = 0;
  const sec = sections[state.sectionIdx];

  els.textEyebrow().textContent =
    `Section · ${state.sectionIdx + 1} of ${sections.length}`;
  els.textName().textContent = sec.name ?? "Section";

  const blades = (sec.blade_numbers?.length
    ? sec.blade_numbers
    : profile.blade_numbers ?? []);
  const wrap = els.blades();
  wrap.innerHTML = `<span class="blades__label">Blades</span>`;
  blades.forEach((b, i) => {
    const pill = document.createElement("span");
    pill.className = "blade" + (i === 0 ? " blade--accent" : "");
    pill.textContent = b;
    wrap.appendChild(pill);
  });
  if (!blades.length) {
    const none = document.createElement("span");
    none.className = "blade";
    none.style.color = "var(--ink-4)";
    none.textContent = "—";
    wrap.appendChild(none);
  }

  els.textBody().textContent = sec.text ?? "";
}

/* ── Warning strip ───────────────────────────────────────── */
function renderWarning(profile) {
  const warn = els.warn();
  if (profile.display?.show_warnings === false || !profile.important_notes?.trim()) {
    warn.classList.add("hidden");
    return;
  }
  warn.classList.remove("hidden");
  els.warnBody().textContent = profile.important_notes;
}

/* ── Keyboard / D-pad ────────────────────────────────────── */
function onKey(e) {
  const tag = (e.target?.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea") return;
  const profile = state.pack?.profiles?.[state.profileId];
  if (!profile) return;
  const sections = visibleSections(profile);
  const imgs     = imageList(profile);

  /* If focus is in the strip, ←/→ change image. Otherwise, leave to
     wireDpadNav() — but for plain keyboard testing in a browser, also
     accept ←/→ on the page. */
  const inStrip = e.target?.closest?.(".strip");
  if (e.key === "ArrowRight" && inStrip) {
    e.preventDefault();
    selectImage(Math.min(imgs.length - 1, state.imageIdx + 1));
    focusThumb(state.imageIdx);
  } else if (e.key === "ArrowLeft" && inStrip) {
    e.preventDefault();
    selectImage(Math.max(0, state.imageIdx - 1));
    focusThumb(state.imageIdx);
  } else if (e.key === "ArrowUp" && e.target?.closest?.(".pager")) {
    e.preventDefault();
    state.sectionIdx = (state.sectionIdx - 1 + sections.length) % sections.length;
    renderSection(profile); updateChipSelection(); focusActiveChip();
  } else if (e.key === "ArrowDown" && e.target?.closest?.(".pager")) {
    e.preventDefault();
    state.sectionIdx = (state.sectionIdx + 1) % sections.length;
    renderSection(profile); updateChipSelection(); focusActiveChip();
  }
}

function focusThumb(idx) {
  els.strip()
    .querySelector(`.thumb[data-idx="${idx}"]`)
    ?.focus();
}

/* ── Helpers ─────────────────────────────────────────────── */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;",
  })[c]);
}
function escapeAttr(s) { return escapeHtml(s); }

init();
