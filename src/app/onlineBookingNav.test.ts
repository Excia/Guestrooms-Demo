import {
  accountMenuLinks,
  buildBreadcrumbs,
  isEmbeddedInApp,
  returnToSiteTooltip,
  type BookingTenant,
} from './onlineBookingNav';

const tenant: BookingTenant = {
  clubName: 'Pine Club',
  axisUrl: 'https://axis.example.com',
  memberAccountUrl: 'https://axis.example.com/me',
  nonMemberAccountUrl: 'https://core.example.com/account',
  memberPaymentsUrl: 'https://paycloud.example.com/methods',
  nonMemberPaymentsUrl: 'https://core.example.com/payments',
};

describe('buildBreadcrumbs', () => {
  it('keeps earlier pages as links and ends with the current page as plain text', () => {
    expect(
      buildBreadcrumbs(
        [{ label: 'Make a Reservation', to: '/book' }, { label: 'Ignored' }],
        'Payment',
      ),
    ).toEqual([{ label: 'Make a Reservation', to: '/book' }, { label: 'Payment' }]);
  });

  it('shows only the current page when there is no trail', () => {
    expect(buildBreadcrumbs([], 'Results')).toEqual([{ label: 'Results' }]);
  });
});

describe('accountMenuLinks', () => {
  it('sends non-members to Core', () => {
    expect(accountMenuLinks('nonMember', tenant).map((l) => l.href)).toEqual([
      'https://core.example.com/account',
      'https://core.example.com/payments',
    ]);
  });

  it('sends members to the Axis account and Paycloud', () => {
    expect(accountMenuLinks('member', tenant).map((l) => l.href)).toEqual([
      'https://axis.example.com/me',
      'https://paycloud.example.com/methods',
    ]);
  });
});

describe('returnToSiteTooltip', () => {
  it('names the club', () => {
    expect(returnToSiteTooltip('Pine Club')).toBe('Return to Pine Club main site.');
  });
});

describe('isEmbeddedInApp', () => {
  it.each(['?embedded=1', '?embedded=true', '?embedded=app', '?a=b&embedded=1'])(
    '%s is embedded',
    (q) => {
      expect(isEmbeddedInApp(q)).toBe(true);
    },
  );

  it.each(['', '?embedded=0', '?embedded=', '?other=1'])('%j is not embedded', (q) => {
    expect(isEmbeddedInApp(q)).toBe(false);
  });
});
