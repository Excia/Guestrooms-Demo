import { render, screen } from '@testing-library/react';
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
});
