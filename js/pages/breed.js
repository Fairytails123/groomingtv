/* Breed working screen — image/text split for one breed/profile. */

import { fetchBreedPack } from "../api.js";
import { wireDpadNav, focusFirst } from "../nav.js";
import { openSearch } from "../search.js";

const els = {
  title:        () => document.getElementById("breed-title"),
  meta:         () => document.getElementById("breed-meta"),
  groomToggle:  () => document.getElementById("groom-toggle"),
  backBtn:      () => document.getElementById("back-btn"),
  refreshBtn:   () => document.getElementById("refresh-btn"),
  searchBtn:    () => document.getElementById("search-btn"),
  stage:        () => document.getElementById("breed-stage"),
  imagePane:    () => document.getElementById("image-pane"),
  textPane:     () => document.getElementById("text-pane"),
  loading:      () => document.getElementById("loading"),
  empty:        () => document.getElementById("empty-state"),
};

let state = {
  slug: null,
  pack: null,
  profileId: null,
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
  try {
    state.pack = await fetchBreedPack(state.slug);
    if (!state.profileId || !state.pack.profiles[state.profileId]) {
      state.profileId = state.pack.default_profile_id;
    }
    render();
  } catch (err) {
    console.error("[breed] fetch failed", err);
    if (err.status === 404) {
      showEmpty(
        "Not in knowledge base yet",
        `No published profile for "${state.slug}". Try Search for a similar breed.`,
      );
    } else {
      showEmpty("Couldn't reach the back end", "Check the salon wifi and tap Refresh.");
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
  els.meta().textContent =
    `${profile.groom_type} · v${profile.version} · ${formatPublished(profile.published_at)}`;

  /* Apply per-profile display ratio.
   * Defaults to 70/30 when missing. */
  const imgPanel = Number(profile.display?.image_panel_width ?? 70);
  const txtPanel = Number(profile.display?.text_panel_width ?? 30);
  els.stage().style.gridTemplateColumns =
    `${imgPanel}fr ${txtPanel}fr`;

  renderGroomToggle(pack);
  renderImagePane(profile);
  renderTextPane(profile);
  focusFirst();
}

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
      const url = new URL(window.location.href);
      url.searchParams.set("profile", pid);
      history.replaceState({}, "", url);
      render();
    });
    wrap.appendChild(btn);
  }
}

function renderImagePane(profile) {
  const pane = els.imagePane();
  pane.innerHTML = "";

  if (profile.images?.main?.url) {
    const main = document.createElement("div");
    main.className = "image-main";
    const img = document.createElement("img");
    img.src = profile.images.main.url;
    img.alt = `${profile.groom_type} main image`;
    img.loading = "eager";
    main.appendChild(img);
    pane.appendChild(main);
  }

  /* Group supplementary images by role. */
  const supplementary = profile.images?.supplementary ?? [];
  if (supplementary.length) {
    const groupsByRole = new Map();
    for (const img of supplementary) {
      const key = img.role || "supplementary";
      if (!groupsByRole.has(key)) groupsByRole.set(key, []);
      groupsByRole.get(key).push(img);
    }
    const ordered = ["front", "back", "head", "supplementary"];
    const sortedKeys = Array.from(groupsByRole.keys()).sort(
      (a, b) => ordered.indexOf(a) - ordered.indexOf(b),
    );
    const wrap = document.createElement("div");
    wrap.className = "image-roles";
    for (const role of sortedKeys) {
      const group = document.createElement("div");
      group.className = "image-role-group";
      const label = document.createElement("div");
      label.className = "image-role-group__label";
      label.textContent = humanRole(role);
      group.appendChild(label);
      const row = document.createElement("div");
      row.className = "image-role-group__row";
      for (const img of groupsByRole.get(role)) {
        const thumb = document.createElement("img");
        thumb.src = img.url;
        thumb.alt = `${role} reference`;
        thumb.loading = "lazy";
        row.appendChild(thumb);
      }
      group.appendChild(row);
      wrap.appendChild(group);
    }
    pane.appendChild(wrap);
  }
}

function humanRole(role) {
  switch (role) {
    case "front": return "Front";
    case "back":  return "Back";
    case "head":  return "Head";
    case "supplementary": return "Other reference";
    default: return role;
  }
}

function renderTextPane(profile) {
  const pane = els.textPane();
  pane.innerHTML = "";

  /* Blade pill row */
  if (profile.display?.show_blade_box !== false && profile.blade_numbers?.length) {
    const box = document.createElement("section");
    box.className = "blade-box";
    box.innerHTML = `<div class="blade-box__title">Blades</div>`;
    const row = document.createElement("div");
    row.className = "blade-row";
    for (const blade of profile.blade_numbers) {
      const pill = document.createElement("span");
      pill.className = "blade-pill";
      pill.textContent = blade;
      row.appendChild(pill);
    }
    box.appendChild(row);
    pane.appendChild(box);
  }

  /* Important notes (warning style) */
  if (profile.display?.show_warnings !== false && profile.important_notes?.trim()) {
    const warn = document.createElement("section");
    warn.className = "warning-box";
    warn.innerHTML = `
      <div class="warning-box__title">Important</div>
      ${escapeHtml(profile.important_notes).replace(/\n/g, "<br>")}`;
    pane.appendChild(warn);
  }

  /* Sections — preserve `order` */
  const sections = (profile.sections ?? []).slice().sort((a, b) => a.order - b.order);
  if (sections.length) {
    const list = document.createElement("section");
    list.className = "section-list";
    for (const s of sections) {
      const isVision = /^Vision findings/i.test(s.name ?? "");
      const sec = document.createElement("article");
      sec.className = "section" + (isVision ? " section--vision" : "");
      const name = document.createElement("h3");
      name.className = "section__name";
      name.textContent = s.name ?? "Section";
      const text = document.createElement("p");
      text.className = "section__text";
      text.textContent = s.text ?? "";
      sec.appendChild(name);
      sec.appendChild(text);
      if (s.blade_numbers?.length) {
        const blades = document.createElement("div");
        blades.className = "section__blades";
        for (const b of s.blade_numbers) {
          const pill = document.createElement("span");
          pill.className = "blade-pill";
          pill.textContent = b;
          blades.appendChild(pill);
        }
        sec.appendChild(blades);
      }
      list.appendChild(sec);
    }
    pane.appendChild(list);
  }
}

function formatPublished(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

init();
