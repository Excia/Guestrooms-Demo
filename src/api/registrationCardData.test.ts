import { buildRegistrationCard } from '../app/registrationCard';
import { createMockClient } from './mock';
import {
  previewRegistrationCardUrl,
  renderRegistrationCardHtml,
  SAMPLE_RESERVATION,
} from './registrationCardData';
import { mockSystemSettings } from './systemSettingsData';

const settings = mockSystemSettings();

describe('renderRegistrationCardHtml', () => {
  it('lays the card out in the order of the PDF frame', () => {
    const html = renderRegistrationCardHtml(
      buildRegistrationCard(
        {
          ...settings.registrationCard,
          items: { ...settings.registrationCard.items, staffSignature: true },
        },
        SAMPLE_RESERVATION,
        settings.folio,
        'Pine Ridge Club',
      ),
    );
    const at = (text: string) => html.indexOf(text);
    expect(at('Pine Ridge Club')).toBeGreaterThan(-1);
    expect(at('Pine Ridge Club')).toBeLessThan(at('Registration Card</h1>'));
    expect(at('#123456')).toBeGreaterThan(-1);
    expect(at('Check In:')).toBeLessThan(at('Room:'));
    expect(at('Guest:')).toBeGreaterThan(at('Guest Count:'));
    expect(at('Guest Signature')).toBeGreaterThan(at('Check In:'));
    expect(at('Staff Signature')).toBeGreaterThan(at('Guest Signature'));
    expect(html).not.toContain('Reserved By:');
  });

  it('escapes what a club or guest typed', () => {
    const html = renderRegistrationCardHtml(
      buildRegistrationCard(
        { ...settings.registrationCard, customText: '<script>alert("x")</script>' },
        SAMPLE_RESERVATION,
        settings.folio,
      ),
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&#60;script&#62;');
  });

  it('only embeds a logo that is an image data URL', () => {
    const card = (logo: string) =>
      renderRegistrationCardHtml(
        buildRegistrationCard(settings.registrationCard, SAMPLE_RESERVATION, {
          ...settings.folio,
          logo,
        }),
      );
    expect(card('data:image/png;base64,AAAA')).toContain('<img');
    expect(card('javascript:alert(1)')).not.toContain('<img');
  });
});

describe('mock registration card client', () => {
  it('answers a preview request with an address to open', async () => {
    const create = vi.fn(() => 'blob:mock-preview');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    const client = createMockClient();
    const { url } = await client.registrationCard.requestPreview({
      settings: settings.registrationCard,
      folio: settings.folio,
    });
    expect(url).toBe('blob:mock-preview');
    const blob = (create.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe('text/html');
    expect(
      previewRegistrationCardUrl({ settings: settings.registrationCard, folio: settings.folio }),
    ).toBe('blob:mock-preview');
  });

  it('fails in the error scenario', async () => {
    await expect(
      createMockClient({ scenario: 'error' }).registrationCard.requestPreview({
        settings: settings.registrationCard,
        folio: settings.folio,
      }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('refuses to save a custom text over 500 characters', async () => {
    const client = createMockClient();
    const bad = {
      ...settings,
      registrationCard: { ...settings.registrationCard, customText: 'a'.repeat(501) },
    };
    await expect(client.systemSettings.save(bad)).rejects.toMatchObject({ status: 422 });
  });
});
