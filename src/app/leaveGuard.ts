// Which clicks leave the page, for the Confirm Leaving dialog (ticket 0.9 pattern).
// The app uses a plain BrowserRouter (no data router), so `useBlocker` is not available:
// the guard watches clicks on in-app links instead, and the browser's own prompt covers reloads and tab close.

/** The in-app path a click on `anchor` would open, or null when it does not leave the page. */
export function leavingPath(
  anchor: Pick<HTMLAnchorElement, 'href' | 'target' | 'download'>,
  current: Pick<Location, 'origin' | 'pathname' | 'search'>,
  event: Pick<
    MouseEvent,
    'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'defaultPrevented'
  >,
): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  if (anchor.download || (anchor.target && anchor.target !== '_self')) return null;
  let url: URL;
  try {
    url = new URL(anchor.href);
  } catch {
    return null;
  }
  if (url.origin !== current.origin) return null;
  const target = `${url.pathname}${url.search}`;
  // Same page (a hash jump such as "Skip to content", or a link to where we already are).
  if (url.pathname === current.pathname && url.search === current.search) return null;
  return target + url.hash;
}
