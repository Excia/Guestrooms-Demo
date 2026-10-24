import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OBJECT_URL_LIFETIME_MS,
  openCardErrorMessage,
  openCardInNewTab,
  PopupBlockedError,
} from './openCardPreview';

const fakeTab = () => ({ location: { href: '' }, close: vi.fn(), opener: {} });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('openCardInNewTab', () => {
  it('points the tab at the address and revokes a blob address after its lifetime', async () => {
    vi.useFakeTimers();
    const tab = fakeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const revoke = vi.fn();
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    await openCardInNewTab(async () => ({ url: 'blob:http://localhost/x' }));
    expect(tab.location.href).toBe('blob:http://localhost/x');
    expect(tab.opener).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(OBJECT_URL_LIFETIME_MS);
    expect(revoke).toHaveBeenCalledWith('blob:http://localhost/x');
  });

  it('closes the blank tab when the request fails or the address is unsafe', async () => {
    const tab = fakeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    await expect(
      openCardInNewTab(async () => {
        throw new Error('down');
      }),
    ).rejects.toThrow('down');
    await expect(openCardInNewTab(async () => ({ url: '/\\evil.example.com' }))).rejects.toThrow();
    expect(tab.close).toHaveBeenCalledTimes(2);
    expect(tab.location.href).toBe('');
  });

  it('requests nothing when the tab is blocked', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const request = vi.fn();
    await expect(openCardInNewTab(request)).rejects.toBeInstanceOf(PopupBlockedError);
    expect(request).not.toHaveBeenCalled();
    expect(openCardErrorMessage(new PopupBlockedError())).toContain('blocked');
    expect(openCardErrorMessage(new Error('x'))).toContain('could not be generated');
  });
});
