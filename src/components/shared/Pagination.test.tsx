import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from './Pagination';

function setup(props: Partial<Parameters<typeof Pagination>[0]> = {}) {
  const onChange = vi.fn();
  render(<Pagination page={2} rowsPerPage={25} total={120} onChange={onChange} {...props} />);
  return { onChange };
}

describe('Pagination', () => {
  it('shows the range text and marks the current page', () => {
    setup();
    expect(screen.getByText('26–50 of 120')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /page 2/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
  });

  it('goes to the next page', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(onChange).toHaveBeenCalledWith({ page: 3, rowsPerPage: 25 });
  });

  it('disables previous on the first page', () => {
    setup({ page: 1 });
    expect(screen.getByRole('button', { name: 'Go to previous page' })).toBeDisabled();
  });

  it('changing rows per page fires ONE change that keeps the first visible row in view', async () => {
    const { onChange } = setup({ page: 3, rowsPerPage: 10 });
    await userEvent.click(screen.getByRole('combobox', { name: /Rows per page/ }));
    await userEvent.click(await screen.findByRole('option', { name: '25' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ page: 1, rowsPerPage: 25 });
  });

  it('shows the rows-per-page select as one compact outlined control: "Rows per page: 25"', async () => {
    setup();
    const select = screen.getByRole('combobox', { name: 'Rows per page' });
    expect(select).toHaveTextContent('Rows per page: 25');
    await userEvent.click(select);
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['10', '25', '50', '100']);
    expect(screen.getByRole('option', { name: '25' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens the rows-per-page menu from the keyboard', async () => {
    const { onChange } = setup({ page: 1, rowsPerPage: 25 });
    screen.getByRole('combobox', { name: 'Rows per page' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.click(await screen.findByRole('option', { name: '50' }));
    expect(onChange).toHaveBeenCalledWith({ page: 1, rowsPerPage: 50 });
  });

  it('corrects an out-of-range page once', () => {
    const { onChange } = setup({ page: 9 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ page: 5, rowsPerPage: 25 });
  });

  it('does not rewrite the page while the total is unknown or 0', () => {
    const { onChange } = setup({ page: 3, total: undefined });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /page 3/ })).toHaveAttribute('aria-current', 'page');
  });

  it('leaves page 3 alone for a total of 0 (first fetch in flight)', () => {
    const { onChange } = setup({ page: 3, total: 0 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('an inline onChange does not re-fire the correction on re-render', () => {
    const calls: unknown[] = [];
    const { rerender } = render(
      <Pagination page={9} rowsPerPage={25} total={120} onChange={(n) => calls.push(n)} />,
    );
    rerender(<Pagination page={9} rowsPerPage={25} total={120} onChange={(n) => calls.push(n)} />);
    expect(calls).toHaveLength(1);
  });

  it('does not call onChange for a valid page on mount', () => {
    const { onChange } = setup();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows an unlisted rows-per-page value without a MUI warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setup({ rowsPerPage: 20 });
    expect(screen.getByRole('combobox', { name: /Rows per page/ })).toHaveTextContent('20');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('shows 0 of 0 when empty', () => {
    setup({ total: 0, page: 1 });
    expect(screen.getByText('0 of 0')).toBeInTheDocument();
  });
});
