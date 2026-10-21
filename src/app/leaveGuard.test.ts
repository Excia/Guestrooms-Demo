import { leavingPath } from './leaveGuard';

const here = { origin: 'http://localhost', pathname: '/admin/primary-setup', search: '' };
const click = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
};
const anchor = (href: string, extra = {}) => ({ href, target: '', download: '', ...extra });

describe('leavingPath', () => {
  it('returns the in-app path a click opens', () => {
    expect(leavingPath(anchor('http://localhost/schedule?x=1#top'), here, click)).toBe(
      '/schedule?x=1#top',
    );
  });

  it('ignores same-page links, other origins, new tabs, downloads and modified clicks', () => {
    expect(
      leavingPath(anchor('http://localhost/admin/primary-setup#main-content'), here, click),
    ).toBeNull();
    expect(leavingPath(anchor('https://example.com/x'), here, click)).toBeNull();
    expect(leavingPath(anchor('http://localhost/a', { target: '_blank' }), here, click)).toBeNull();
    expect(leavingPath(anchor('http://localhost/a', { download: 'f' }), here, click)).toBeNull();
    expect(leavingPath(anchor('http://localhost/a'), here, { ...click, ctrlKey: true })).toBeNull();
    expect(leavingPath(anchor('http://localhost/a'), here, { ...click, button: 1 })).toBeNull();
    expect(
      leavingPath(anchor('http://localhost/a'), here, { ...click, defaultPrevented: true }),
    ).toBeNull();
    expect(leavingPath(anchor('not a url'), here, click)).toBeNull();
  });
});
