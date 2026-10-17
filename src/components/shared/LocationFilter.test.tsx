import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LocationFilter from './LocationFilter';

const LOCATIONS = [
  { id: 'a', name: 'Location A' },
  { id: 'b', name: 'Location B' },
  { id: 'c', name: 'Location C' },
];

describe('LocationFilter', () => {
  it('CTA is a button that opens the filter', async () => {
    const onOpen = vi.fn();
    render(
      <LocationFilter
        variant="cta"
        locations={LOCATIONS}
        value={[]}
        onChange={vi.fn()}
        onOpen={onOpen}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Filter by location' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('field defaults to All Locations', () => {
    render(<LocationFilter variant="field" locations={LOCATIONS} value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /Location/ })).toHaveTextContent('All Locations');
    expect(screen.queryByRole('button', { name: 'Clear locations' })).not.toBeInTheDocument();
  });

  it('adds a location from the menu with the keyboard', async () => {
    const onChange = vi.fn();
    render(<LocationFilter variant="field" locations={LOCATIONS} value={[]} onChange={onChange} />);
    screen.getByRole('combobox').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(await screen.findByRole('option', { name: 'Location B' }));
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('All Locations in the menu clears the selection', async () => {
    const onChange = vi.fn();
    render(
      <LocationFilter variant="field" locations={LOCATIONS} value={['a']} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'All Locations' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows chips, deletes one and clears all', async () => {
    const onChange = vi.fn();
    render(
      <LocationFilter
        variant="field"
        locations={LOCATIONS}
        value={['a', 'b']}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('Location A')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear locations' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('the remove button is optional and labelled', async () => {
    const onRemove = vi.fn();
    render(
      <LocationFilter
        variant="field"
        locations={LOCATIONS}
        value={[]}
        onChange={vi.fn()}
        onRemove={onRemove}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove location filter' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
