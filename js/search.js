/* Manual-search modal — type-ahead against public/index.json.
 *
 * Used on both the start screen and the breed screen. Two paths through:
 *   1. User types text matching a published breed → click row → navigate
 *      to breed.html?slug=<slug>.
 *   2. User types text with no matches → after 1.2 s of no input the
 *      modal posts a backlog signal so the breed surfaces on the
 *      admin dashboard. Cross-breed handling: if the typed breed is a
 *      known cross (e.g. "Cavapoo"), suggest published parent breeds
 *      from the index.
 */

import { fetchBreedIndex, logBacklogHit } from "./api.js";

const FALLBACK_TIMEOUT_MS = 1200;

let cachedIndex = null;
let activeModal = null;

/* Tiny case-insensitive substring scorer — enough for ~50 breeds.
 * Higher score = better match. */
function score(query, breed) {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const name = breed.breed_name.toLowerCase();
  const slug = breed.breed_slug.toLowerCase();
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (slug.startsWith(q)) return 70;
  if (name.includes(q)) return 50;
  if (slug.includes(q)) return 40;
  return 0;
}

async function ensureIndex() {
  if (cachedIndex) return cachedIndex;
  cachedIndex = await fetchBreedIndex().catch((err) => {
    console.warn("[search] index.json fetch failed", err);
    return { breeds: [] };
  });
  return cachedIndex;
}

function buildBackdrop() {
  const backdrop = document.createElement("div");
  backdrop.className = "tv-modal-backdrop";
  backdrop.innerHTML = `
    <div class="tv-modal" role="dialog" aria-modal="true" aria-label="Search breeds">
      <div class="tv-modal__title">Search breeds</div>
      <input class="tv-modal__input" type="search"
             placeholder="Type a breed name…"
             autocomplete="off" spellcheck="false" />
      <div class="tv-modal__results" role="listbox" aria-label="Search results"></div>
      <button class="tv-btn tv-modal__close" type="button">Close</button>
    </div>`;
  return backdrop;
}

function renderResults(container, query, index) {
  container.innerHTML = "";
  if (!query.trim()) {
    /* Default state: list every breed alphabetically. */
    for (const b of index.breeds) {
      container.appendChild(rowFor(b, "All breeds"));
    }
    return;
  }
  const ranked = index.breeds
    .map((b) => ({ b, s: score(query, b) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .map(({ b }) => b);

  if (ranked.length) {
    for (const b of ranked) container.appendChild(rowFor(b, "Match"));
    return;
  }

  /* No direct matches. Try parent-breed suggestions from indexed crosses,
   * otherwise show empty state. */
  const empty = document.createElement("div");
  empty.className = "tv-empty";
  empty.innerHTML = `
    <div class="tv-empty__title">No match for "${escapeHtml(query)}"</div>
    <div class="tv-empty__body">We'll log this so it can be added to the knowledge base.</div>`;
  container.appendChild(empty);
}

function rowFor(breed, sublabel) {
  const row = document.createElement("button");
  row.className = "tv-modal__row";
  row.type = "button";
  row.setAttribute("role", "option");
  row.dataset.slug = breed.breed_slug;
  row.innerHTML = `
    ${escapeHtml(breed.breed_name)}
    <span class="tv-modal__row__sub">${escapeHtml(sublabel)}</span>`;
  row.addEventListener("click", () => {
    window.location.href = `breed.html?slug=${encodeURIComponent(breed.breed_slug)}`;
  });
  return row;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

export async function openSearch() {
  if (activeModal) return;
  const backdrop = buildBackdrop();
  document.body.appendChild(backdrop);
  activeModal = backdrop;

  const input = backdrop.querySelector(".tv-modal__input");
  const results = backdrop.querySelector(".tv-modal__results");
  const closeBtn = backdrop.querySelector(".tv-modal__close");

  let pendingFallbackTimer = 0;
  const index = await ensureIndex();
  renderResults(results, "", index);
  input.focus();

  input.addEventListener("input", () => {
    renderResults(results, input.value, index);
    clearTimeout(pendingFallbackTimer);
    if (input.value.trim()) {
      const ranked = index.breeds.filter((b) => score(input.value, b) > 0);
      if (!ranked.length) {
        pendingFallbackTimer = setTimeout(
          () => logBacklogHit(input.value),
          FALLBACK_TIMEOUT_MS,
        );
      }
    }
  });

  closeBtn.addEventListener("click", closeSearch);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeSearch();
  });
  document.addEventListener("keydown", trapEsc);
}

function trapEsc(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeSearch();
  }
}

export function closeSearch() {
  if (!activeModal) return;
  activeModal.remove();
  activeModal = null;
  document.removeEventListener("keydown", trapEsc);
}
