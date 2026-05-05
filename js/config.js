/* TV display config — single source of truth for back-end URLs. */

export const BACKEND_PUBLIC_URL =
  "https://fairytails123.github.io/groomingbackend/public";

/* Apps Script Web App URL — only used for log_backlog_hit (a public op,
 * no auth required). Kept here so future TV-side ops can reuse it. */
export const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby5CU8J-xyCn38ruoe_HdDswRBCNcxXLO9O2AyiiHDt781mwsJzWeyyahySfwjpq4ZL/exec";

export const DEFAULT_SESSION_PACK = "today";
