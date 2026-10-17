import type { RouteMeta } from './routes';

export interface Crumb {
  title: string;
  path: string;
}

const MAX_PARENTS = 2;

/** Current page preceded by up to two parent levels, outermost first. Unknown paths give []. */
export function getBreadcrumbs(pathname: string, routes: RouteMeta[]): Crumb[] {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const byPath = new Map(routes.map((r) => [r.path, r]));
  const trail: Crumb[] = [];
  const seen = new Set<string>();
  let route = byPath.get(normalized);
  while (route && !seen.has(route.path) && trail.length < MAX_PARENTS + 1) {
    seen.add(route.path);
    trail.unshift({ title: route.title, path: route.path });
    route = route.parent ? byPath.get(route.parent) : undefined;
  }
  return trail;
}
