/**
 * Where "Return to Site" points. Set VITE_AXIS_URL per environment; when unset or blank we fall
 * back to "/" (the site root of the host serving this app) so the link is never dead.
 */
export function getAxisUrl(value: string | undefined = import.meta.env.VITE_AXIS_URL): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '/';
}
