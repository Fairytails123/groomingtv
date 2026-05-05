/* Remote / keyboard navigation helpers.
 *
 * The Vidaa TV remote D-pad emits standard Arrow keys + Enter, plus a
 * Backspace-equivalent "back" key. We rely on the browser's native focus
 * order for Tab; this module adds:
 *   - ArrowUp / ArrowDown move focus along the focusable list.
 *   - ArrowLeft / ArrowRight do the same (so a 2-column grid feels natural).
 *   - Backspace / Esc routes back to the start screen via onBack().
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "input:not([disabled])",
  "select:not([disabled])",
].join(",");

export function getFocusables(root = document.body) {
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((el) => !el.closest(".tv-hidden"))
    .filter((el) => el.offsetParent !== null);
}

function moveFocus(delta) {
  const list = getFocusables();
  if (!list.length) return;
  const idx = list.indexOf(document.activeElement);
  let next = idx === -1 ? 0 : idx + delta;
  if (next < 0) next = 0;
  if (next >= list.length) next = list.length - 1;
  list[next]?.focus();
}

/* Wires keyboard / D-pad nav at document level.
 * onBack: function called when Backspace / Esc / browser back is pressed. */
export function wireDpadNav({ onBack } = {}) {
  document.addEventListener("keydown", (e) => {
    /* Inside a text input, let the browser handle keys. */
    const tag = e.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") {
      if (e.key === "Escape") {
        e.target.blur();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        moveFocus(+1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(-1);
        break;
      case "Backspace":
      case "Escape":
        if (onBack) {
          e.preventDefault();
          onBack();
        }
        break;
      default:
        /* No-op — Tab + Enter behave natively. */
    }
  });
}

/* Focus the first focusable element on the page. */
export function focusFirst(root = document.body) {
  const list = getFocusables(root);
  list[0]?.focus();
}
