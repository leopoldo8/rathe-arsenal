/**
 * setCssVar — set or remove a CSS custom property on a DOM element.
 *
 * Idempotent. Null element is a no-op. Null value removes the property.
 * Numeric 0 is preserved — not falsy-coerced.
 */
export function setCssVar(
  el: HTMLElement | null,
  name: `--${string}`,
  value: string | number | null,
): void {
  if (!el) return;
  if (value === null) {
    el.style.removeProperty(name);
  } else {
    el.style.setProperty(name, String(value));
  }
}
