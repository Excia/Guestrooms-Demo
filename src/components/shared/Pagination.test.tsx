import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from './Pagination';

function setup(props: Partial<Parameters<typeof Pagination>[0]> = {}) {
  const onPageChange = vi.fn();
  const onRowsPerPageChange = vi.fn();
  render(
    <Pagination
      page={2}
      rowsPerPage={25}
      total={120}
      onPageChange={onPageChange}
      onRowsPerPageChange={onRowsPerPageChange}
      {...props}
    />,
  );
  return { onPageChange, onRowsPerPageChange };
}

describe('Pagination', () => {
  it('shows the range text and marks the current page', () => {
    setup();
    expect(screen.getByText('26–50 of 120')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /page 2/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
  });

  it('goes to the next page', async () => {
    const { onPageChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('disables previous on the first page', () => {
    setup({ page: 1 });
    expect(screen.getByRole('button', { name: 'Go to previous page' })).toBeDisabled();
  });

  it('changing rows per page keeps the first visible row in view', async () => {
    const { onRowsPerPageChange, onPageChange } = setup({ page: 3, rowsPerPage: 10 });
    await userEvent.click(screen.getByRole('combobox', { name: /Rows per page/ }));
    await userEvent.click(await screen.findByRole('option', { name: '25' }));
    expect(onRowsPerPageChange).toHaveBeenCalledWith(25);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('shows 0 of 0 when empty', () => {
    setup({ total: 0, page: 1 });
    expect(screen.getByText('0 of 0')).toBeInTheDocument();
  });
});
