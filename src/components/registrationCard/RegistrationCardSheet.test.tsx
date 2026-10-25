import { fireEvent, render, screen } from '@testing-library/react';
import { buildRegistrationCard } from '../../app/registrationCard';
import { defaultRegistrationCard } from '../../app/registrationCard';
import { SAMPLE_RESERVATION, SAMPLE_SYSTEM_NAME } from '../../app/registrationCardSample';
import type { FolioDetails } from '../../api/types';
import RegistrationCardSheet from './RegistrationCardSheet';

const folio: FolioDetails = {
  streetAddress: '1 Main St',
  city: 'Cincinnati',
  state: 'OH',
  zip: '45238',
  email: 'a@b.co',
  phone: '555-0100',
  customText: '',
  logo: null,
};

const build = (patch: (items: Record<string, boolean>) => void = () => {}) => {
  const settings = defaultRegistrationCard();
  patch(settings.items);
  return buildRegistrationCard(settings, SAMPLE_RESERVATION, folio, SAMPLE_SYSTEM_NAME);
};

describe('RegistrationCardSheet', () => {
  it('prints black text on white paper (the document, not the theme)', () => {
    render(<RegistrationCardSheet card={build()} />);
    const style = getComputedStyle(screen.getByTestId('registration-card-sheet'));
    expect(style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(style.color).toBe('rgb(0, 0, 0)');
  });

  it('leaves out the header block and the signatures when their items are off', () => {
    render(
      <RegistrationCardSheet
        card={build((i) => {
          i.folioHeader = false;
          i.guestSignature = false;
        })}
      />,
    );
    expect(screen.queryByText('LOGO')).not.toBeInTheDocument();
    expect(screen.queryByText('Guest Signature')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Registration Card' })).toBeInTheDocument();
  });

  it('splits the room from its italic bracket and prints the flags', () => {
    render(
      <RegistrationCardSheet
        card={build((i) => {
          i.roomType = true;
          i.earlyCheckInFlag = true;
          i.lateCheckOutFlag = true;
        })}
      />,
    );
    expect(screen.getByText('Room 204')).toBeInTheDocument();
    expect(screen.getByText('(King Suite)')).toHaveStyle({ fontStyle: 'italic' });
    expect(screen.getByText('Early Check In')).toBeInTheDocument();
    expect(screen.getByText('Late Check Out')).toBeInTheDocument();
  });

  it('refuses a logo that is not an image data address', () => {
    const card = build();
    if (card.header) card.header.logo = 'javascript:alert(1)';
    render(<RegistrationCardSheet card={card} />);
    expect(screen.getByText('LOGO')).toBeInTheDocument();
  });

  it('breaks long unbroken text instead of running past the sheet edge', () => {
    const long = 'x'.repeat(500);
    const settings = defaultRegistrationCard();
    settings.customText = long;
    const card = buildRegistrationCard(settings, SAMPLE_RESERVATION, folio, SAMPLE_SYSTEM_NAME);
    render(<RegistrationCardSheet card={card} />);
    expect(screen.getByText(long)).toBeInTheDocument();
    expect(getComputedStyle(screen.getByTestId('registration-card-sheet')).overflowWrap).toBe(
      'anywhere',
    );
  });

  it('builds the room and its bracket from separate parts', () => {
    const card = build((i) => {
      i.roomType = true;
    });
    expect(card.roomParts).toEqual({ number: 'Room 204', detail: '(King Suite)' });
  });

  it('falls back to the LOGO box when the logo fails to load', () => {
    const card = build();
    if (card.header) card.header.logo = 'data:image/png;base64,AAAA';
    render(<RegistrationCardSheet card={card} />);
    fireEvent.error(screen.getByRole('img', { name: 'Logo' }));
    expect(screen.getByText('LOGO')).toBeInTheDocument();
  });

  it('is built to stack on small screens (one column, tighter padding, header stacked)', () => {
    render(<RegistrationCardSheet card={build()} />);
    // jsdom does not compute grid or media queries, so read the emitted rules: the base (phone)
    // rules are one column and a stacked header; the two-column rules sit behind a min-width query.
    const css = Array.from(document.querySelectorAll('style'))
      .map((el) => el.textContent ?? '')
      .join('')
      .replace(/\s+/g, '');
    expect(css).toContain('grid-template-columns:minmax(0,1fr)');
    expect(css).toContain('flex-direction:column');
    expect(css).toMatch(
      /@media\(min-width:\d+px\)\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
    );
    expect(css).toMatch(/@media\(min-width:\d+px\)\{[^}]*flex-direction:row/);
  });
});
