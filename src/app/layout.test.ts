import { MENU_MIN_FONT_PX, MENU_SCALE, menuFontPx, menuPx } from './layout';

describe('menu scale', () => {
  it('scales Figma px by MENU_SCALE, rounded', () => {
    expect(menuPx(70)).toBe(Math.round(70 * MENU_SCALE));
    expect(menuPx(0)).toBe(0);
  });

  it('never lets text fall below the minimum font size', () => {
    expect(menuFontPx(15)).toBeGreaterThanOrEqual(MENU_MIN_FONT_PX);
    expect(menuFontPx(22)).toBeGreaterThanOrEqual(MENU_MIN_FONT_PX);
    expect(menuFontPx(200)).toBe(menuPx(200));
  });

  it('keeps rows touch-friendly (at least 40px)', () => {
    expect(menuPx(70)).toBeGreaterThanOrEqual(40);
    expect(menuPx(68)).toBeGreaterThanOrEqual(40);
  });
});
