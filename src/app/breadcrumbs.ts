import { findRoute, type RouteMeta } from './routes';

export interface Crumb {
  title: string;
  path: string;
}

const MAX_PARENTS = 2;

/** Current page preceded by up to two parent levels, outermost first. Unknown paths give []. */
export function getBreadcrumbs(pathname: string, routes: RouteMeta[]): Crumb[] {
  const trail: Crumb[] = [];
  const seen = new Set<string>();
  let route = findRoute(pathname, routes);
  while (route && !seen.has(route.path) && trail.length < MAX_PARENTS + 1) {
    seen.add(route.path);
    trail.unshift({ title: route.title, path: route.path });
    route = route.parent ? findRoute(route.parent, routes) : undefined;
  }
  return trail;
}
