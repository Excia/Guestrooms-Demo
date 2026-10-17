import { getBreadcrumbs } from './breadcrumbs';
import { routes } from './routes';

describe('getBreadcrumbs', () => {
  it('returns just the page for a top-level route', () => {
    expect(getBreadcrumbs('/schedule', routes).map((c) => c.title)).toEqual(['Schedule']);
  });
  it('returns up to two parents plus the current page', () => {
    expect(getBreadcrumbs('/admin/rooms', routes).map((c) => c.title)).toEqual([
      'Schedule',
      'Admin Setup',
      'Rooms',
    ]);
  });
  it('caps the trail at two parents', () => {
    const deep = [
      { path: '/a', title: 'A' },
      { path: '/b', title: 'B', parent: '/a' },
      { path: '/c', title: 'C', parent: '/b' },
      { path: '/d', title: 'D', parent: '/c' },
    ];
    expect(getBreadcrumbs('/d', deep).map((c) => c.title)).toEqual(['B', 'C', 'D']);
  });
  it('tolerates trailing slashes, unknown paths and cycles', () => {
    expect(getBreadcrumbs('/admin/', routes)).toHaveLength(2);
    expect(getBreadcrumbs('/nope', routes)).toEqual([]);
    const loop = [
      { path: '/a', title: 'A', parent: '/b' },
      { path: '/b', title: 'B', parent: '/a' },
    ];
    expect(getBreadcrumbs('/a', loop)).toHaveLength(2);
  });
});
