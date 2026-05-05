# Fairy Tails Grooming TV display

Read-only PWA that the salon's Hisense TV (Vidaa browser) navigates to at
`https://fairytails123.github.io/groomingtv/`. Renders the per-breed grooming
knowledge produced by the back-end repo
[`Fairytails123/groomingbackend`](https://github.com/Fairytails123/groomingbackend).

## What it shows

- **Start screen** (`index.html`) — today's bookings as large remote-friendly
  breed buttons, with AM/PM/All filter and a manual-search fallback for any
  breed not in today's list.
- **Breed screen** (`breed.html?slug=…`) — the working view: main image,
  supplementary images grouped by role, blade-number pill row, important
  notes, and every section in order.

## Data sources (read-only)

Pulled cross-origin from the back end's GitHub Pages site:

| What | Where |
|---|---|
| Today's bookings | `https://fairytails123.github.io/groomingbackend/public/today.json` |
| Breed search index | `https://fairytails123.github.io/groomingbackend/public/index.json` |
| Per-breed pack | `https://fairytails123.github.io/groomingbackend/public/breeds/{slug}.json` |
| Images | absolute URLs inside breed packs |

The TV writes one thing back: a public Apps Script op
`log_backlog_hit` is called when manual search yields no result, so unmatched
breeds surface as backlog signals on the admin dashboard.

## Tech

Vanilla HTML / CSS / ES modules. No framework, no build step. Served straight
off GitHub Pages from `main`.

## Local development

```bash
# From this repo's root
npx http-server -p 8081
# open http://localhost:8081/
```

The Vidaa TV is the load-bearing device — confirm anything significant
in the salon before assuming desktop Chrome rendering matches.

## License

Internal project for Fairy Tails K9 Centre. No public license.
