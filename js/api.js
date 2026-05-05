/* Thin fetch wrapper — pure read-only GETs against the back-end's
 * GitHub Pages, plus one public POST to log_backlog_hit. */

import { BACKEND_PUBLIC_URL, APPS_SCRIPT_URL } from "./config.js";

async function getJson(url) {
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) {
    const err = new Error(`Fetch ${url} → HTTP ${resp.status}`);
    err.status = resp.status;
    err.url = url;
    throw err;
  }
  return resp.json();
}

export async function fetchToday() {
  return getJson(`${BACKEND_PUBLIC_URL}/today.json`);
}

export async function fetchBreedPack(slug) {
  if (!slug) throw new Error("fetchBreedPack: slug required");
  return getJson(`${BACKEND_PUBLIC_URL}/breeds/${encodeURIComponent(slug)}.json`);
}

export async function fetchBreedIndex() {
  return getJson(`${BACKEND_PUBLIC_URL}/index.json`);
}

/* Posts to Apps Script's `log_backlog_hit` op. Public op, no auth.
 * Best-effort — failures are swallowed so the UI never blocks. */
export async function logBacklogHit(rawBreed) {
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        op: "log_backlog_hit",
        raw_breed: String(rawBreed ?? "").trim(),
        source: "tv_search",
      }),
    });
  } catch (err) {
    console.warn("[api] log_backlog_hit failed", err);
  }
}
