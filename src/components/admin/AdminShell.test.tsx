import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../../api';
import { createMockClient } from '../../api/mock';
import { GrantedAccess } from '../../app/testing';
import AdminShell from './AdminShell';

function renderShell(active = 'Locations') {
  return render(
    <ApiProvider client={createMockClient()}>
      <GrantedAccess>
        <MemoryRouter>
          <AdminShell active={active} title="Page">
            content
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
