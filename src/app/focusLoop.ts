// Pure helpers for the menu overlay's keyboard handling (Tab loop and link clicks).

const TABBABLE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[tabindex]',
].join(',');

function isShown(el: HTMLElement): boolean {
  if (el.closest('[hidden], [inert]')) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

/** Elements under the roots that a user can reach with Tab, in DOM order. */
export function getTabbables(roots: Array<HTMLElement | null | undefined>): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (const root of roots) {
    if (!root) continue;
    for (const el of root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)) {
      const tabindex = el.getAttribute('tabindex');
      if (tabindex !== null && Number(tabindex) < 0) continue;
      if (el.matches(':disabled') || !isShown(el)) continue;
      found.push(el);
    }
  }
  return found;
}

/**
 * Where Tab should move focus to keep it inside `scope` (header controls + panel), or null to let
 * the browser handle it. The panel itself and non-tabbable content inside it are left to the native
 * order, so Tab right after opening enters the panel at its first link.
 */
export function nextFocusTarget(
  scope: HTMLElement[],
  panel: HTMLElement,
  active: Element | null,
  shift: boolean,
): HTMLElement | null {
  const first = scope[0];
  const last = scope[scope.length - 1];
  if (!first || !last) return null;
  if (active && panel.contains(active) && !scope.includes(active as HTMLElement)) return null;
  const inScope = scope.includes(active as HTMLElement);
  if (!inScope) return shift ? last : first;
  if (shift && active === first) return last;
  if (!shift && active === last) return first;
  return null;
}

/** A plain primary-button click: not a modified click that opens the link elsewhere. */
export function isPlainLeftClick(e: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
