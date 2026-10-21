// Pure rules for the online booking header (ticket 5.1): breadcrumbs, the Account Menu destinations
// and the embedded-in-mobile-app flag. The component renders what these return.

export type BookingAudience = 'member' | 'nonMember';

/** Per-club values the header needs; later read from tenant config (Q-48-1 confirms the URLs). */
export interface BookingTenant {
  clubName: string;
  /** Club favicon; the header shows the club's initial when it is missing. */
  faviconUrl?: string;
  /** Main club site; Return to Site goes here. */
  axisUrl: string;
  memberAccountUrl: string;
  nonMemberAccountUrl: string;
  /** Members manage payment methods in Paycloud, non-members in Core. */
  memberPaymentsUrl: string;
  nonMemberPaymentsUrl: string;
}

export interface Crumb {
  label: string;
  /** Present on every crumb except the current page. */
  to?: string;
}

/** The trail as the header shows it: earlier pages are links, the last one is the current page. */
export function buildBreadcrumbs(trail: Crumb[], currentPage: string): Crumb[] {
  return [
    ...trail.filter((c) => c.to).map((c) => ({ label: c.label, to: c.to })),
    { label: currentPage },
  ];
}

export interface AccountLink {
  id: 'account' | 'payment-methods';
  label: string;
  href: string;
}

export function accountMenuLinks(audience: BookingAudience, tenant: BookingTenant): AccountLink[] {
  const member = audience === 'member';
  return [
    {
      id: 'account',
      label: 'Account',
      href: member ? tenant.memberAccountUrl : tenant.nonMemberAccountUrl,
    },
    {
      id: 'payment-methods',
      label: 'Payment Methods',
      href: member ? tenant.memberPaymentsUrl : tenant.nonMemberPaymentsUrl,
    },
  ];
}

/** Text of the Return to Site tooltip. */
export function returnToSiteTooltip(clubName: string): string {
  return `Return to ${clubName} main site.`;
}

/** Query parameter the mobile app adds to the embedded page (Q-48-2 confirms how it signals this). */
export const EMBEDDED_PARAM = 'embedded';

/** True when the page runs inside the club's mobile app, which supplies its own navigation. */
export function isEmbeddedInApp(search: string): boolean {
  const value = new URLSearchParams(search).get(EMBEDDED_PARAM);
  return value === '1' || value === 'true' || value === 'app';
}
