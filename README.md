# Fairy Tails Grooming TV display

> **Read this in full before touching anything.** Then the back-end's
> [`docs/HANDOVER.md`](https://github.com/Fairytails123/groomingbackend/blob/main/docs/HANDOVER.md)
> (operational truth for the data this TV consumes), then the canonical
> spec at `groomingbackend/.md/grooming-knowledge-software-architecture.md`
> (v3.10, §0a #39–#44 are the TV-specific decisions).
>
> **System state — Stage 1 TV display LIVE with Apple-inspired breed
> redesign.** Renders the per-breed grooming knowledge produced by
> [`Fairytails123/groomingbackend`](https://github.com/Fairytails123/groomingbackend).
> Designed for the salon's actual TV (Hisense 40" 40E4QTUK FHD,
> 1920×1080, Vidaa browser).

**Last updated:** 2026-05-06 — handover pass. Last code commit: `85fbe79`
(breed-page Apple redesign drop-in from Claude Design).

---

## 0. For a fresh Claude / Cowork session — first 5 minutes

1. **Read this file end-to-end** + the back-end's
   [`docs/HANDOVER.md`](https://github.com/Fairytails123/groomingbackend/blob/main/docs/HANDOVER.md)
   §2 (Live deployment state) and §4 (what's done).
2. **Sanity check the live system:**
   ```bash
   curl -s -o /dev/null -w "tv root:    %{http_code}\n" \
     https://fairytails123.github.io/groomingtv/
   curl -s -o /dev/null -w "tv breed:   %{http_code}\n" \
     "https://fairytails123.github.io/groomingtv/breed.html?slug=miniature-schnauzer"
   curl -s -o /dev/null -w "today.json: %{http_code}\n" \
     https://fairytails123.github.io/groomingbackend/public/today.json
   curl -s -o /dev/null -w "index.json: %{http_code}\n" \
     https://fairytails123.github.io/groomingbackend/public/index.json
   ```
   All four should return `200`.
3. **Check git state:** `git log --oneline -5`. The newest commit on this
   branch should be `85fbe79 Breed page redesign — Apple-inspired,
   interactive thumbnail strip` (or newer if you're picking up after
   another iteration). If `git status` shows local CRLF noise, the
   `.gitattributes` `* text=auto eol=lf` rule should normalise on next
   commit; don't panic.
4. **Pick a task** from §5 "Open follow-ups" below — they're ranked by
   what unblocks the most.

**The single biggest pending item:** live verification on the actual
Hisense Vidaa browser at the salon (the load-bearing test for Stage 1).
Desktop Chrome rendering passes, but Vidaa's CSS support — especially
`backdrop-filter` on the topbar — needs a real-device walk-through.

---

## 1. What this project is

The TV-facing half of the Fairy Tails Grooming Knowledge Software. Mounted
on a Hisense 40" 40E4QTUK in the salon, it shows the day's booked breeds
and lets groomers walk up and reference each breed's grooming notes,
blade numbers, and reference images while working on a dog.

Built and deployed in a single afternoon (2026-05-05) once the back-end
Knowledge factory (Stages 2–5 + Phase 2) was producing publish-validated
JSON for every breed.

It is open (no login), read-only against the back end (one exception below),
and never scrolls — the breed view fits one 1920×1080 viewport and uses
a section pager + interactive thumbnail strip rather than scroll-and-read.

---

## 2. Live deployment state

| What | Where |
|---|---|
| GitHub repo | https://github.com/Fairytails123/groomingtv |
| GitHub Pages site (live URL) | https://fairytails123.github.io/groomingtv/ |
| Pages source | `main` branch, `/` (root) — enabled via `gh api` on initial push |
| Local working copy | `C:\Users\FT Manager\OneDrive\Business\CODING\groomingtv\` |
| Back-end repo it consumes | https://github.com/Fairytails123/groomingbackend (Pages: https://fairytails123.github.io/groomingbackend/) |
| Apps Script Web App used (one public op only) | `https://script.google.com/macros/s/AKfycby5CU8J-xyCn38ruoe_HdDswRBCNcxXLO9O2AyiiHDt781mwsJzWeyyahySfwjpq4ZL/exec` |

There is **no** auth, no service token, no CI, no build step.

---

## 3. Repo layout

```
groomingtv/
├── README.md                  ← this file
├── .gitattributes             ← * text=auto eol=lf (avoids CRLF flips on Windows)
├── .gitignore                 ← excludes .claude/ (local dev aid only)
├── 404.html                   ← simple back-to-home fallback
├── index.html                 ← start screen — today's bookings
├── breed.html                 ← working screen — Apple-inspired single-screen view
├── css/
│   ├── tokens.css             ← original sky-blue + Plus Jakarta Sans tokens (drives index.html)
│   ├── base.css               ← shared reset + topbar/buttons/pills/modal styles
│   ├── start.css              ← start-screen-only layout (3×3 grid, capacity-bounded)
│   └── breed.css              ← breed-screen-only layout (Claude Design redesign;
│                                 has its own :root token block — --brand, --ink, --bg,
│                                 --surface, --shadow-1/2, --r-sm/md/lg/xl, --warn-*)
└── js/
    ├── config.js              ← BACKEND_PUBLIC_URL + APPS_SCRIPT_URL constants
    ├── api.js                 ← fetchToday / fetchBreedPack / fetchBreedIndex / logBacklogHit
    ├── nav.js                 ← D-pad / arrow-key roving focus + onBack hook
    ├── search.js              ← manual-search modal — type-ahead vs. index.json,
    │                            calls log_backlog_hit on misses after 1.2 s
    └── pages/
        ├── start.js           ← today.json → 3×3 grid, AM/PM filter, +N more overflow
        └── breed.js           ← breed pack → image+text split, section pager,
                                  interactive thumbnail strip, groom-type toggle
```

`.claude/launch.json` exists locally for `npx http-server` in the
Cowork preview tool — gitignored, not part of the deploy.

---

## 4. Data contracts (read-only against the back end)

Three JSON files served from `https://fairytails123.github.io/groomingbackend/public/`.
Schema below is the v1 (`schema_version: 1`) shape; the renderers will
log a console warning on a higher version but still attempt to render.

### `today.json`

```jsonc
{
  "schema_version": 1,
  "generated_at": "2026-05-05T05:00:03.421Z",
  "session_date": "2026-05-05",
  "saturday_open": false,
  "bookings": [
    {
      "booking_id": "JF-12345",
      "appointment_datetime": "2026-05-05T10:30:00Z",
      "appointment_type": "Full Groom",
      "raw_breed": "mini schnauzer",
      "matched": true,
      "breed_id": "BRD-001",
      "breed_slug": "miniature-schnauzer",
      "breed_pack_url": "/groomingbackend/public/breeds/miniature-schnauzer.json",
      "fallback": null
    }
  ]
}
```

`fallback` is non-null when `matched === false`; it carries
`{ reason: "not_in_kb", suggested_breed_ids: [...] }` so the start
screen can offer parent-breed alternatives for crosses.

### `index.json`

```jsonc
{
  "schema_version": 1,
  "generated_at": "2026-05-05T06:45:00Z",
  "breeds": [
    {
      "breed_id": "BRD-001",
      "breed_name": "Miniature Schnauzer",
      "breed_slug": "miniature-schnauzer",
      "breed_type": "pure",
      "parent_breed_ids": []
    }
  ]
}
```

GitHub Pages doesn't expose directory listings, so this flat list is the
TV's autocomplete source for the manual-search modal. Written by the
back end's `apps-script/publish.gs:writePublicIndex_()` after every
publish/unpublish; rebuild manually via `rebuildPublicIndex()` in the
Apps Script editor if it drifts.

### `breeds/{slug}.json`

```jsonc
{
  "schema_version": 1,
  "breed_id": "BRD-001",
  "breed_name": "Miniature Schnauzer",
  "breed_slug": "miniature-schnauzer",
  "breed_type": "pure",
  "parent_breed_ids": [],
  "default_profile_id": "PRF-001",
  "profiles": {
    "PRF-001": {
      "groom_type": "Pet Groom",
      "version": 17,
      "blade_numbers": ["#10", "#7F", "#5F"],
      "important_notes": "Many pet owners…",
      "is_default": true,
      "sections": [
        { "section_id": "SEC-001", "name": "Body", "order": 1,
          "text": "…", "blade_numbers": ["#10", "#7F"] }
      ],
      "images": {
        "main": { "image_id": "IMG-008", "url": "https://…/IMG-008.jpg",
                  "width_px": 1104, "height_px": 975 },
        "supplementary": [
          { "image_id": "IMG-001", "role": "front",
            "url": "https://…/IMG-001.jpg",
            "label": "Front pose"   /* optional, redesign reads if present */ }
        ]
      },
      "display": {
        "image_panel_width": 56,    /* clamped into [40, 60] on the TV */
        "show_warnings": true
      }
    }
  }
}
```

Sections whose name matches `/^Vision findings/i` are auto-extracted
admin-review material — **the TV hides them**. They stay in the JSON
because they're useful in the admin editor for reviewing the AI pass.

### One write-back: `log_backlog_hit`

When `js/search.js` sees ~1.2s of unmatched typing it POSTs to the
Apps Script Web App with:

```jsonc
{ "op": "log_backlog_hit", "raw_breed": "<query>", "source": "tv_search" }
```

Public op (no auth, no service token). Fails silently — the TV never
blocks on it. The back end logs the row to the `Backlog Signals` sheet
so unmet breeds surface on the admin dashboard.

---

## 5. Open follow-ups

Ordered by what unblocks the most. Pick one, finish it, update this
section.

### P0 — Live verification on the Hisense Vidaa browser

The salon TV is the load-bearing device for Stage 1. Walk the start →
breed → search flow on the actual TV with the actual remote. Specifically:

- Topbar `backdrop-filter: saturate(180%) blur(20px)` — Vidaa is
  Chromium-based and *should* support this, but if it doesn't the topbar
  will fall back to flat translucent white. If even that looks broken,
  swap the topbar background to `rgba(255,255,255,.92)` and ship.
- Section pager chips are 60 px tall — confirm they're tappable / D-pad
  selectable from the salon's normal viewing distance.
- Interactive thumbnail strip — confirm clicking a thumb cross-fades it
  into the main display (180 ms transition). If the cross-fade flickers,
  drop the `transition: opacity .35s` on `.main-img__inner`.
- `prefers-reduced-motion` gate on transitions — verify by enabling
  reduce-motion in Vidaa's accessibility settings (if available).
- If anything is unfixable in CSS, plug a Fire TV Stick at the same
  URL — it's the documented escape hatch (see back-end spec §6.18).

### P1 — Search modal restyle

`js/search.js` and the `.tv-modal-*` rules in `css/base.css` were
deliberately left untouched by the breed-page redesign drop. The modal
still works but visually carries the older v1 sky-blue aesthetic
(rounded card on dark backdrop, brand-blue input ring). Promote it to
the redesign's Apple-leaning surfaces — same translucent topbar feel,
same JetBrains Mono on any monospace bits.

### P2 — Start-page restyle decision

The start screen (`index.html` + `css/start.css`) still uses the v1
tokens — sky-blue accents, Plus Jakarta Sans, 3×3 grid of breed cards.
Two paths:

1. **Promote redesign tokens to `tokens.css`** — both pages share an
   Apple-leaning aesthetic. Cohesive but more work.
2. **Keep as-is** — the start page is glanced at; the breed page is
   stared at. Different purposes, different chrome is OK.

Decide once Vidaa rendering is confirmed (P0) so we don't double-restyle.

### P3 — Service worker / offline cache + PWA install

Spec §0a #43 deferred this until Vidaa rendering is verified. Once P0
is green:

- `manifest.json` for PWA install (apple-touch-icons + theme-color
  already match).
- Service worker that caches `today.json` + every breed pack listed in
  it + main images. Cache size could grow to hundreds of MB at scale —
  decide whether to cap to today's bookings only or the whole library.
- Vidaa SW reliability is unverified; if SW fails silently, fall back
  to localStorage cache of `today.json` only so the TV still shows the
  last-known list on transient wifi loss.

### P4 — `aria-live="polite"` on the main image card

Claude Design's README flagged this as a known follow-up. Tiny a11y win
— when a thumb swap fires, screen readers announce the new role chip.
The salon TV is sighted-only, so it's free a11y rather than blocking.

---

## 6. How to verify the system is healthy (cheat-sheet)

| Check | Command / step | Expected |
|---|---|---|
| TV root alive | `curl -s -o /dev/null -w "%{http_code}\n" https://fairytails123.github.io/groomingtv/` | `200` |
| TV breed page alive | `curl -s -o /dev/null -w "%{http_code}\n" "https://fairytails123.github.io/groomingtv/breed.html?slug=miniature-schnauzer"` | `200` |
| Today.json reachable | `curl -s https://fairytails123.github.io/groomingbackend/public/today.json \| jq '.bookings \| length'` | A non-negative number |
| Index.json reachable | `curl -s https://fairytails123.github.io/groomingbackend/public/index.json \| jq '.breeds \| length'` | At least `1` (Miniature Schnauzer is the seed) |
| Breed pack reachable | `curl -s https://fairytails123.github.io/groomingbackend/public/breeds/miniature-schnauzer.json \| jq '.breed_name'` | `"Miniature Schnauzer"` |
| Start page renders | Open the TV root URL in a browser. Empty state ("No grooms today") OR up to 9 breed cards in a 3-col grid. No vertical scroll. | — |
| Breed page renders | Open `breed.html?slug=miniature-schnauzer`. Translucent topbar, segmented Pet/Show toggle (1 option = hidden), section pager with `01..05` numerals, hero main image + 6-thumb interactive strip, eyebrow + section name + blade pills + body text on the right, warning strip at the bottom. | — |
| Thumbnail swap works | Click any thumbnail in the strip. The main image cross-fades (180 ms) and the role chip on the main image updates. | — |
| Section pager works | Click any section chip. The right pane re-renders with the new section's name, blade pills, and body. The eyebrow updates to "Section · N of M". | — |

---

## 7. Bugs fixed during this build (don't reintroduce)

In chronological order. Only the ones that left a trap if you're not careful.

1. **Breed page initially scrolled long sections (2026-05-05 morning).**
   First-cut `breed.css` made `.text-pane` scrollable when section text
   exceeded the viewport. User feedback: TV displays should never scroll.
   Fix in commit `124316f`: `body.breed-page { overflow: hidden }`,
   one-section-at-a-time pager, body text via `clamp(20px, 1.4vw, 26px)`.
   Lesson: TV is not a desktop browser; treat overflow as a design bug,
   not a fallback.

2. **Image pane initially stacked supplementary thumbnails vertically
   (same morning).** Stacking created its own scroll axis. Same commit
   replaced the vertical stack with a single horizontal thumb row
   (`grid-auto-flow: column`), capped at 6 items. Lesson: any list of
   images on the TV must be a fixed-size grid that fits the viewport,
   not a flow that grows.

3. **`fetch` cache served stale JSON during dev (intermittent).**
   `today.json` updates every cron tick on the back end; the TV's
   `fetch()` would sometimes serve a stale copy from the disk cache.
   `js/api.js` now passes `{ cache: "no-store" }` on every fetch.
   Lesson: GitHub Pages caching + browser disk cache compound; always
   no-store on data the TV must see fresh.

4. **`breed-card__name` overflowed on long breed names (2026-05-05
   evening).** Long breed names like "Miniature Bull Terrier (cross)"
   broke the 3-column grid. Fix in `start.css`: `white-space: nowrap;
   overflow: hidden; text-overflow: ellipsis;` on the card title.
   Lesson: every text node on the TV needs a clip strategy.

5. **First commit's `git push` failed without local user.email
   (2026-05-05 morning).** The fresh clone of `groomingtv` had no
   `.git/config` user. Fix: ran `git config user.email "k.singh3184@gmail.com"`
   and `user.name "Kamal Singh"` locally to match the back-end repo's
   identity. Lesson: when scaffolding a brand-new repo from a clone of
   an empty GitHub repo, set the local identity before the first commit.

---

## 8. How a fresh session should pick up cold

1. **Read this file in full** (you just did).
2. **Cross-read the back-end:** `groomingbackend/docs/HANDOVER.md` §2
   (live URLs) and §4 (what's done). You don't need the whole spec
   unless touching the data shape — §0a #39–#44 in
   `.md/grooming-knowledge-software-architecture.md` is the TV-specific
   slice.
3. **Verify alive:** the cheat-sheet in §6 above.
4. **Check git state:** `git log --oneline -10` should show the recent
   commits (`85fbe79` is the latest as of 2026-05-06). If `git status`
   shows local CRLF noise, `.gitattributes` will normalise on next
   commit — don't panic.
5. **For new work:** respect the back-end's design-first feedback —
   for non-trivial UI changes, sketch the approach first (file paths,
   token names, data flow) and get a thumbs-up before writing code.
6. **For Vidaa-specific quirks:** start with the salon TV; if a CSS
   feature degrades, fall back rather than monkey-patch. The Fire TV
   Stick at the same URL is the documented escape hatch.

---

## 9. Local development

```bash
# From this repo's root
npx http-server -p 8081
# open http://localhost:8081/
```

Or from Cowork: `.claude/launch.json` is pre-wired so the `tv` server
in the launch picker just works.

The Vidaa TV remains the load-bearing device — confirm anything
significant in the salon before assuming desktop Chrome rendering
matches.

---

## License

Internal project for Fairy Tails K9 Centre. No public license.
