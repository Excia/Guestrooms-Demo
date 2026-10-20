import { act, render, screen } from '@testing-library/react';
import DashboardColumn from './DashboardColumn';

let observers: { callback: () => void; disconnect: ReturnType<typeof vi.fn> }[] = [];
let sizes = { scrollHeight: 100, clientHeight: 300 };

beforeEach(() => {
  observers = [];
  sizes = { scrollHeight: 100, clientHeight: 300 };
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnect = vi.fn();
      constructor(callback: () => void) {
        observers.push({ callback, disconnect: this.disconnect });
      }
      observe() {}
      unobserve() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
    () => sizes.scrollHeight,
  );
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
    () => sizes.clientHeight,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const scrollArea = () => screen.getByText('content').parentElement!.parentElement!;

describe('DashboardColumn', () => {
  it('is not a region or focusable while the content fits', () => {
    render(<DashboardColumn title="Quick Stats">content</DashboardColumn>);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(scrollArea()).not.toHaveAttribute('tabindex');
  });

  it('is a focusable region named by the title while overflowing', () => {
    sizes = { scrollHeight: 900, clientHeight: 300 };
    render(<DashboardColumn title="Quick Stats">content</DashboardColumn>);
    const region = screen.getByRole('region', { name: 'Quick Stats' });
    expect(region).toHaveAttribute('tabindex', '0');
  });

  it('toggles when the content grows and shrinks', () => {
    render(<DashboardColumn title="Quick Stats">content</DashboardColumn>);
    sizes = { scrollHeight: 900, clientHeight: 300 };
    act(() => observers.forEach((o) => o.callback()));
    expect(screen.getByRole('region', { name: 'Quick Stats' })).toBeInTheDocument();
    sizes = { scrollHeight: 100, clientHeight: 300 };
    act(() => observers.forEach((o) => o.callback()));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('keeps the region while it has focus, even after overflow ends', () => {
    sizes = { scrollHeight: 900, clientHeight: 300 };
    render(<DashboardColumn title="Quick Stats">content</DashboardColumn>);
    const region = screen.getByRole('region', { name: 'Quick Stats' });
    act(() => region.focus());
    sizes = { scrollHeight: 100, clientHeight: 300 };
    act(() => observers.forEach((o) => o.callback()));
    expect(screen.getByRole('region', { name: 'Quick Stats' })).toHaveFocus();
    act(() => region.blur());
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('disconnects the observer on unmount', () => {
    const { unmount } = render(<DashboardColumn title="Quick Stats">content</DashboardColumn>);
    unmount();
    expect(observers.length).toBeGreaterThan(0);
    observers.forEach((o) => expect(o.disconnect).toHaveBeenCalled());
  });

  it('pads the panel by default and not with disablePadding', () => {
    const { rerender } = render(<DashboardColumn title="A">content</DashboardColumn>);
    expect(getComputedStyle(scrollArea()).padding).not.toMatch(/^0(px)?$/);
    rerender(
      <DashboardColumn title="A" disablePadding>
        content
      </DashboardColumn>,
    );
    expect(getComputedStyle(scrollArea()).padding).toMatch(/^0(px)?$/);
  });
});
