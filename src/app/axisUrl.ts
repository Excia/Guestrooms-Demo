const FALLBACK = '/';
let warned = false;

function warnOnce(reason: string, value: string | undefined) {
  if (import.meta.env.DEV && !warned) {
    warned = true;
    console.warn(
      `VITE_AXIS_URL ${reason} (${JSON.stringify(value)}); "Return to Site" links to "/".`,
    );
  }
}

/**
 * Where "Return to Site" points. Set VITE_AXIS_URL per environment. Only http(s) URLs or
 * same-origin paths are accepted; a missing or rejected value falls back to "/".
 */
export function getAxisUrl(
  value: string | undefined = import.meta.env.VITE_AXIS_URL,
  origin: string = window.location.origin,
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    warnOnce('is not set', value);
    return FALLBACK;
  }
  try {
    const url = new URL(trimmed, origin);
    const isRelativePath = trimmed.startsWith('/') && !trimmed.startsWith('//');
    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (isRelativePath || /^https?:\/\//i.test(trimmed))
    ) {
      return trimmed;
    }
  } catch {
    // fall through to the rejection below
  }
  warnOnce('is not an http(s) URL or same-origin path', value);
  return FALLBACK;
}
