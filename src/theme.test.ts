import { theme } from './theme';

describe('theme tokens (Figma variables)', () => {
  it('has the palette', () => {
    const { palette } = theme;
    expect(palette.mode).toBe('light');
    expect(palette.primary.main).toBe('#2e7d32');
    expect(palette.primary.contrastText).toBe('#ffffff');
    expect(palette.primary.tint).toBe('#eaf2ea');
    expect(palette.primary.outlinedBorder).toBe('rgba(46, 125, 50, 0.5)');
    expect(palette.warning.main).toBe('#c24e00');
    expect(palette.error.main).toBe('#d32f2f');
    expect(palette.text.primary).toBe('#000000de');
    expect(palette.text.secondary).toBe('#00000099');
    expect(palette.action.active).toBe('#0000008f');
    expect(palette.background.default).toBe('#f1f1f1');
    expect(palette.background.paper).toBe('#ffffff');
  });

  it('has shape and type variants', () => {
    expect(theme.shape.borderRadius).toBe(4);
    const t = theme.typography;
    expect(t.subtitle1).toMatchObject({ fontSize: '1.125rem', fontWeight: 500 });
    expect(t.subtitle2).toMatchObject({ fontSize: '0.875rem', fontWeight: 500 });
    expect(t.h4_fixed).toMatchObject({ fontSize: '1rem', fontWeight: 700 });
    expect(t.caption).toMatchObject({ fontSize: '0.75rem', fontWeight: 400 });
  });

  it('maps button sizes', () => {
    const o = theme.components?.MuiButton?.styleOverrides as Record<string, Record<string, unknown>>;
    expect(o.sizeSmall).toMatchObject({ fontSize: `${13 / 16}rem`, fontWeight: 500, letterSpacing: '0.03538em' });
    expect(o.sizeMedium).toMatchObject({ fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.02857em' });
    expect(o.sizeLarge).toMatchObject({ fontSize: `${15 / 16}rem`, fontWeight: 500, letterSpacing: '0.03067em' });
  });

  it('styles inputs', () => {
    const c = theme.components!;
    expect(c.MuiInputBase?.styleOverrides?.input).toMatchObject({ fontSize: '1rem', fontWeight: 400 });
    expect(c.MuiInputLabel?.styleOverrides?.root).toMatchObject({ fontSize: '0.75rem', lineHeight: 1 });
    expect(c.MuiOutlinedInput?.styleOverrides?.notchedOutline).toMatchObject({ borderColor: '#0000003b' });
  });
});
