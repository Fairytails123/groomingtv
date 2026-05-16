# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The TV-facing half of the Fairy Tails Grooming Knowledge Software. A static HTML/CSS/JS site rendered on a Hisense 40" 40E4QTUK (1920×1080, Vidaa browser) mounted in the grooming salon. It shows the day's bookings and lets groomers walk up to a per-breed reference (notes, blade numbers, images) while working.

It is read-only against the back-end (`Fairytails123/groomingbackend`) and writes to one public Apps Script op only (`log_backlog_hit`). No auth, no service token, no build step, no CI.

The full project handover lives in `README.md` (~400 lines) — read it once when picking up cold; it has the live URLs, data contracts, open follow-ups, and the list of "don't reintroduce" bugs.

## Commands

```bash
# Local dev — only command you need
npx http-server -p 8081
# then open http://localhost:8081/
```

There is no build, no lint, no test suite, and no package.json. Deploy is automatic: push to `main` → GitHub Pages serves it at https://fairytails123.github.io/groomingtv/.

`.claude/launch.json` is pre-wired for the in-IDE `tv` server picker (it just runs the http-server above). It's gitignored.

Quick liveness check (back-end + TV both up):

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://fairytails123.github.io/groomingtv/
curl -s https://fairytails123.github.io/groomingbackend/public/today.json | jq '.bookings | length'
```

## Architecture

Two pages, vanilla ES modules, no framework:

- `index.html` + `js/pages/start.js` — start screen. Fetches `today.json` from the back-end, renders up to 9 bookings in a 3×3 grid (overflow → use Search). AM/PM/All filter. Each card links to `breed.html?slug=<slug>`.
- `breed.html` + `js/pages/breed.js` — working screen. Fetches `breeds/{slug}.json`, renders one section at a time (section pager chips), an interactive bottom thumbnail strip that cross-fades into the main image, blade pills, body text, and an "Important" warning strip.

Shared modules:

- `js/config.js` — `BACKEND_PUBLIC_URL` and `APPS_SCRIPT_URL`. Single source of truth.
- `js/api.js` — `fetchToday` / `fetchBreedPack` / `fetchBreedIndex` / `logBacklogHit`. **Every fetch passes `cache: "no-store"`** (GitHub Pages + browser disk cache compound otherwise).
- `js/nav.js` — D-pad/arrow-key roving focus across all visible focusables; routes Backspace/Esc to an `onBack` hook. The TV remote sends standard Arrow keys + Enter + Backspace, so nothing TV-specific is needed.
- `js/search.js` — modal overlay shared by both pages. Type-ahead against `index.json`; after 1.2 s of unmatched typing it best-effort POSTs `log_backlog_hit` to the Apps Script (failures swallowed).

Data flow is one-directional: back-end Apps Script → publishes JSON to `groomingbackend/public/` → this TV fetches it. The TV never writes to the knowledge base; the only write is the unmatched-search signal above.

### CSS / token structure (important gotcha)

There are **two parallel token systems** that do not share variable names:

- `css/tokens.css` — the original v1 sky-blue + Plus Jakarta Sans tokens (`--color-brand`, `--font-size-*`, `--space-*`, `--shadow-*`). Drives `index.html` (via `css/start.css`) and shared chrome in `css/base.css`.
- `css/breed.css` — the breed-page redesign carries its **own** `:root` block (`--brand`, `--ink`, `--bg`, `--surface`, `--shadow-1/2`, `--r-sm/md/lg/xl`, `--warn-*`). It is intentionally decoupled.

The two are not synchronised. Editing `tokens.css` will not affect `breed.css` and vice versa. The README's P2 follow-up tracks the open decision about whether to unify them.

### Data contracts

The TV consumes three JSON files from `https://fairytails123.github.io/groomingbackend/public/`:

- `today.json` — today's bookings, each with `breed_slug`, `matched`, `appointment_datetime`, etc. Unmatched bookings carry `fallback.suggested_breed_ids`.
- `index.json` — flat `{breed_id, breed_name, breed_slug, breed_type, parent_breed_ids}[]` used as the search autocomplete source (Pages has no directory listings).
- `breeds/{slug}.json` — full breed pack with one or more `profiles` (groom types). Each profile has `sections[]`, `blade_numbers[]`, `important_notes`, `images.{main, supplementary[]}`, and `display.{image_panel_width, show_warnings}`.

Full schemas are in `README.md` §4. Renderers tolerate higher `schema_version` (log a console warning, attempt to render).

## Invariants (do not violate)

These come from real bugs that were fixed during the initial build — see `README.md` §7 for the history.

- **The TV never scrolls.** `body.breed-page { overflow: hidden }` is load-bearing. If a section's text grows past the viewport, treat it as a design bug (shrink type, add pagination) — not a fallback. The start screen is capped at 9 cards for the same reason; the rest live behind Search.
- **Every fetch uses `cache: "no-store"`.** `today.json` updates per cron tick on the back-end; stale caches will silently show yesterday's bookings.
- **Sections matching `/^Vision findings/i` must be hidden** in the breed page — they are auto-extracted AI-review material kept in the JSON for the admin editor only. `js/pages/breed.js` filters them via `VISION_RX`.
- **Image lists are fixed-size grids, not flowing stacks.** The supplementary thumb strip is capped to `THUMB_LIMIT = 6` and laid out with `grid-auto-flow: column`. Adding a vertical stack reintroduces a scroll axis.
- **Long text needs a clip strategy.** Breed-card titles, section names, etc. — assume any user-visible string can overflow and apply `text-overflow: ellipsis` or `clamp()` sizing.
- **Vidaa is the load-bearing device, not desktop Chrome.** Anything that uses modern CSS (`backdrop-filter`, etc.) needs verification on the actual salon TV. The documented escape hatch when a feature degrades is to plug a Fire TV Stick at the same URL rather than monkey-patching.

## Repo conventions

- `.gitattributes` enforces `* text=auto eol=lf` — don't fight it if `git status` shows transient CRLF noise on Windows; it normalises on next commit.
- `.claude/` is gitignored (local dev aid only). Do not commit launch configs or session state into the deployed site.
- Pages source is `main` branch, `/` (root) — every commit to `main` ships. There is no staging environment, so verify locally first.
