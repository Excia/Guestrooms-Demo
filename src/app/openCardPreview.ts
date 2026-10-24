// Opens a backend-generated card (PDF) in a new tab (D-003) without leaving a blank tab behind.
import { isOpenablePreviewUrl } from './registrationCard';

/** How long a generated object URL stays valid; the tab has loaded it long before. */
export const OBJECT_URL_LIFETIME_MS = 60_000;

/** The browser refused the new tab (a popup blocker). */
export class PopupBlockedError extends Error {
  constructor() {
    super('The new tab was blocked');
    this.name = 'PopupBlockedError';
  }
}

/**
 * Opens a tab inside the click (so a popup blocker allows it), asks for the file, then points the tab
 * at it. If the tab is blocked nothing is requested; if the request fails or the address is unsafe the
 * blank tab is closed and the error is thrown. A `blob:` address is revoked after a minute.
 */
export async function openCardInNewTab(request: () => Promise<{ url: string }>): Promise<void> {
  const tab = window.open('', '_blank');
  if (!tab) throw new PopupBlockedError();
  tab.opener = null;
  try {
    const { url } = await request();
    if (!isOpenablePreviewUrl(url)) throw new Error('Unsafe preview address');
    tab.location.href = url;
    if (url.startsWith('blob:')) {
      setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
    }
  } catch (error) {
    tab.close();
    throw error;
  }
}

/** Message for the person who clicked. */
export function openCardErrorMessage(error: unknown): string {
  return error instanceof PopupBlockedError
    ? 'Your browser blocked the new tab. Allow pop-ups for this site and try again.'
    : 'The preview could not be generated. Try again.';
}
