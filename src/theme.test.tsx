import { render, screen } from '@testing-library/react';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ThemeProvider } from '@mui/material/styles';
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
    const o = theme.components?.MuiButton?.styleOverrides as Record<
      string,
      Record<string, unknown>
    >;
    expect(o.sizeSmall).toMatchObject({
      fontSize: `${13 / 16}rem`,
      fontWeight: 500,
      letterSpacing: '0.03538em',
    });
    expect(o.sizeMedium).toMatchObject({
      fontSize: '0.875rem',
      fontWeight: 500,
      letterSpacing: '0.02857em',
    });
    expect(o.sizeLarge).toMatchObject({
      fontSize: `${15 / 16}rem`,
      fontWeight: 500,
      letterSpacing: '0.03067em',
    });
  });

  it('styles inputs', () => {
    const c = theme.components!;
    expect(c.MuiInputBase?.styleOverrides?.input).toMatchObject({
      fontSize: '1rem',
      fontWeight: 400,
    });
    expect(c.MuiOutlinedInput?.styleOverrides?.notchedOutline).toMatchObject({
      borderColor: 'rgba(0, 0, 0, 0.23)',
    });
  });

  it('renders the shrunk input label at 12px (16px root scaled 0.75)', () => {
    render(
      <ThemeProvider theme={theme}>
        <TextField label="Check In" value="01/02/2026" onChange={() => {}} />
      </ThemeProvider>,
    );
    const label = screen.getByText('Check In', { selector: 'label' });
    const style = getComputedStyle(label);
    expect(style.fontSize).toBe('16px');
    expect(style.transform).toContain('scale(0.75)');
  });

  it('renders h4_fixed as a heading', () => {
    render(
      <ThemeProvider theme={theme}>
        <Typography variant="h4_fixed">Title</Typography>
      </ThemeProvider>,
    );
    expect(screen.getByRole('heading', { level: 4, name: 'Title' })).toBeInTheDocument();
  });

  it('draws a focus-visible outline on buttons and links', () => {
    const buttonRoot = theme.components?.MuiButtonBase?.styleOverrides?.root as (a: {
      theme: typeof theme;
    }) => Record<string, Record<string, unknown>>;
    expect(buttonRoot({ theme })['&.Mui-focusVisible']).toMatchObject({
      outline: `2px solid ${theme.palette.primary.main}`,
    });
    const linkRoot = theme.components?.MuiLink?.styleOverrides?.root as typeof buttonRoot;
    expect(linkRoot({ theme })['&:focus-visible']).toMatchObject({
      outline: `2px solid ${theme.palette.primary.main}`,
    });
  });
});
