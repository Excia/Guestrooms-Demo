import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../../api';
import { createMockClient } from '../../api/mock';
import { GrantedAccess } from '../../app/testing';
import AdminShell from './AdminShell';

function renderShell(active = 'Locations', body: React.ReactNode = 'content') {
  return render(
    <ApiProvider client={createMockClient()}>
      <GrantedAccess>
        <MemoryRouter>
          <AdminShell active={active} title="Page">
            {body}
          </AdminShell>
        </MemoryRouter>
      </GrantedAccess>
    </ApiProvider>,
  );
}

describe('AdminShell side navigation', () => {
  it('marks only the active item as the current page', () => {
    renderShell();
    expect(screen.getByRole('link', { name: 'Locations' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Room Options' })).not.toHaveAttribute('aria-current');
  });

  // Legacy SideBarControl: a 5px bar pinned to the panel edge, 15px from the tab, rounded on the left.
  it('draws one 5px active bar pinned to the right edge of the active item', () => {
    renderShell();
    const bars = screen.getAllByTestId('admin-nav-active-bar');
    expect(bars).toHaveLength(1);
    const style = getComputedStyle(bars[0]);
    expect(style.position).toBe('absolute');
    expect(style.right).toBe('0px');
    expect(style.width).toBe('5px');
    expect(style.height).toBe('100%');
    expect(style.borderRadius).toBe('4px 0 0 4px');
    expect(bars[0].parentElement).toHaveStyle({ position: 'relative' });
    expect(bars[0]).toHaveAttribute('aria-hidden', 'true');
  });
});

// Decision D-AP-4: the document does not scroll from lg up; only the content body does.
describe('AdminShell scroll regions', () => {
  function cssText() {
    return Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n');
  }

  it('keeps the navigation and the page header outside the scrolling content', () => {
    renderShell();
    const scroll = screen.getByRole('region', { name: 'Page content' });
    expect(scroll).toBe(screen.getByTestId('admin-scroll'));
    expect(scroll).toHaveTextContent('content');
    expect(scroll).not.toContainElement(screen.getByRole('navigation', { name: 'Admin Setup' }));
    expect(scroll).not.toContainElement(screen.getByRole('heading', { level: 1, name: 'Page' }));
    expect(screen.getByTestId('admin-header')).toContainElement(
      screen.getByRole('heading', { level: 1, name: 'Page' }),
    );
    expect(screen.getByTestId('admin-header')).not.toContainElement(scroll);
  });

  it('sizes the shell to the viewport and scrolls only the body and the navigation from lg up', () => {
    renderShell();
    const css = cssText();
    // Emotion writes the lg rules inside a min-width media query.
    expect(css).toMatch(/@media \(min-width:1200px\)\{[^}]*height:calc\(100dvh - /);
    expect(css).toMatch(/@media \(min-width:1200px\)\{[^}]*overflow:hidden/);
    expect(css).toMatch(/@media \(min-width:1200px\)\{[^}]*overflow-y:auto/);
    expect(css).toMatch(/scroll-padding-block:/);
  });

  it('lets keyboard users reach the scroll region and keeps focused fields inside it', async () => {
    const user = userEvent.setup();
    renderShell('Locations', <input aria-label="Last field" />);
    const scroll = screen.getByTestId('admin-scroll');
    expect(scroll).toHaveAttribute('tabindex', '0');
    const field = screen.getByLabelText('Last field');
    field.focus();
    // focus() scrolls the nearest scrollable ancestor, which must be the inner container.
    expect(field.closest('[data-testid="admin-scroll"]')).toBe(scroll);
    await user.tab();
    expect(document.activeElement).not.toBe(field);
  });
});
