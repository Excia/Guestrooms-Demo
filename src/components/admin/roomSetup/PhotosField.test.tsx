import { ThemeProvider } from '@mui/material/styles';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ApiProvider } from '../../../api';
import { createMockClient } from '../../../api/mock';
import type { ApiClient, RoomPhoto } from '../../../api/types';
import { DELETE_ARM_MS, DELETE_LAPSE_MS } from '../../../app/photos';
import { ReadOnlyContext } from '../../../app/readOnlyContext';
import { theme } from '../../../theme';
import PhotosField from './PhotosField';

const photo = (id: string): RoomPhoto => ({ id, name: `${id}.jpg`, url: '' });

function Harness({
  initial,
  onChange,
}: {
  initial: RoomPhoto[];
  onChange?: (p: RoomPhoto[]) => void;
}) {
  const [photos, setPhotos] = useState(initial);
  return (
    <PhotosField
      owner="room"
      entityId="room-1"
      photos={photos}
      onChange={(next) => {
        setPhotos(next);
        onChange?.(next);
      }}
    />
  );
}

function setup(
  initial: RoomPhoto[] = [],
  client: ApiClient = createMockClient({ latencyMs: 0 }),
  readOnly = false,
) {
  const onChange = vi.fn();
  const user = userEvent.setup({ applyAccept: false });
  render(
    <ApiProvider client={client}>
      <ThemeProvider theme={theme}>
        <ReadOnlyContext.Provider value={{ readOnly, baseTheme: null }}>
          <Harness initial={initial} onChange={onChange} />
        </ReadOnlyContext.Provider>
      </ThemeProvider>
    </ApiProvider>,
  );
  return { user, onChange, client };
}

const names = () =>
  within(screen.getByRole('list', { name: 'Photos' }))
    .getAllByRole('img')
    .map((el) => el.getAttribute('aria-label'));
const input = () => screen.getByLabelText('Photo files');
const file = (name: string, type = 'image/png', size = 1000) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

afterEach(() => vi.useRealTimers());

describe('PhotosField', () => {
  it('shows an empty state and the rules', () => {
    setup();
    expect(screen.getByText('No photos')).toBeVisible();
    expect(screen.getByText('0 of 50 photos')).toBeVisible();
    expect(screen.getByText(/JPG or PNG, up to 1.5 MB each, up to 10 at a time/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Edit photo order' })).not.toBeInTheDocument();
  });

  it('uploads through the API and adds the photos in order', async () => {
    const { user, onChange } = setup([photo('a')]);
    await user.upload(input(), [file('b.png'), file('c.jpg', 'image/jpeg')]);
    await waitFor(() => expect(names()).toEqual(['a.jpg', 'b.png', 'c.jpg']));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('File(s) uploaded successfully');
    expect(screen.getByText('3 of 50 photos')).toBeVisible();
  });

  it('names every file it leaves out and still uploads the good ones', async () => {
    const { user } = setup();
    await user.upload(input(), [
      file('ok.png'),
      file('doc.pdf', 'application/pdf'),
      file('big.png', 'image/png', 2e6),
    ]);
    await waitFor(() => expect(names()).toEqual(['ok.png']));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('doc.pdf is not a JPG or PNG image.');
    expect(alert).toHaveTextContent('big.png is larger than 1.5 MB.');
  });

  it('adds nothing and calls nothing when every file is refused', async () => {
    const client = createMockClient({ latencyMs: 0 });
    const upload = vi.spyOn(client.photos, 'upload');
    const { user, onChange } = setup([], client);
    await user.upload(input(), [file('doc.pdf', 'application/pdf')]);
    expect(await screen.findByRole('alert')).toHaveTextContent('doc.pdf');
    expect(upload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows an error and keeps the photos when the upload fails', async () => {
    const client = createMockClient({ latencyMs: 0 });
    vi.spyOn(client.photos, 'upload').mockRejectedValue(new ApiError(500, 'down'));
    const { user, onChange } = setup([photo('a')], client);
    await user.upload(input(), [file('b.png')]);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The photos could not be uploaded. Try again.',
    );
    expect(names()).toEqual(['a.jpg']);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Add photos' })).toBeEnabled();
  });

  it('shows Uploading and disables Add photos while the upload runs', async () => {
    const client = createMockClient({ latencyMs: 0 });
    let finish: (p: RoomPhoto[]) => void = () => undefined;
    vi.spyOn(client.photos, 'upload').mockReturnValue(
      new Promise<RoomPhoto[]>((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = setup([], client);
    await user.upload(input(), [file('b.png')]);
    expect(await screen.findByRole('button', { name: 'Uploading…' })).toBeDisabled();
    await act(async () => finish([photo('b')]));
    expect(await screen.findByRole('button', { name: 'Add photos' })).toBeEnabled();
  });

  it('disables Add photos at the total limit', () => {
    setup(Array.from({ length: 50 }, (_, i) => photo(`p${i}`)));
    expect(screen.getByRole('button', { name: 'Add photos' })).toBeDisabled();
  });

  it('hides the controls in view-only mode', () => {
    setup([photo('a'), photo('b')], undefined, true);
    expect(screen.queryByRole('button', { name: 'Add photos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit photo order' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove photo/ })).not.toBeInTheDocument();
    expect(names()).toEqual(['a.jpg', 'b.jpg']);
  });

  describe('delete', () => {
    it('asks twice: the first click arms, the second removes after the arming delay', async () => {
      const { user } = setup([photo('a'), photo('b')]);
      await user.click(screen.getByRole('button', { name: 'Remove photo a.jpg' }));
      const confirm = screen.getByRole('button', { name: 'Confirm remove photo a.jpg' });
      expect(confirm).toHaveFocus();
      expect(names()).toEqual(['a.jpg', 'b.jpg']);
      await waitFor(() => expect(confirm).toHaveAttribute('aria-disabled', 'false'));
      await user.click(confirm);
      expect(names()).toEqual(['b.jpg']);
    });

    it('ignores a press in the first half second', async () => {
      vi.useFakeTimers();
      setup([photo('a')]);
      fireEvent.click(screen.getByRole('button', { name: 'Remove photo a.jpg' }));
      const confirm = screen.getByRole('button', { name: 'Confirm remove photo a.jpg' });
      fireEvent.click(confirm);
      expect(names()).toEqual(['a.jpg']);
      act(() => void vi.advanceTimersByTime(DELETE_ARM_MS));
      fireEvent.click(confirm);
      expect(screen.queryByRole('list', { name: 'Photos' })).not.toBeInTheDocument();
    });

    it('lapses after five seconds and keeps the photo', () => {
      vi.useFakeTimers();
      setup([photo('a')]);
      fireEvent.click(screen.getByRole('button', { name: 'Remove photo a.jpg' }));
      act(() => void vi.advanceTimersByTime(DELETE_LAPSE_MS));
      expect(screen.getByRole('button', { name: 'Remove photo a.jpg' })).toBeVisible();
      expect(names()).toEqual(['a.jpg']);
    });

    it('cancels on Escape and returns the focus to the remove button', async () => {
      const { user } = setup([photo('a')]);
      await user.click(screen.getByRole('button', { name: 'Remove photo a.jpg' }));
      await user.keyboard('{Escape}');
      const badge = await screen.findByRole('button', { name: 'Remove photo a.jpg' });
      await waitFor(() => expect(badge).toHaveFocus());
      expect(names()).toEqual(['a.jpg']);
    });

    it('arms only one photo at a time', async () => {
      const { user } = setup([photo('a'), photo('b')]);
      await user.click(screen.getByRole('button', { name: 'Remove photo a.jpg' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove photo b.jpg' }));
      expect(screen.getAllByRole('button', { name: /^Confirm remove/ })).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Confirm remove photo b.jpg' })).toBeVisible();
    });
  });

  describe('order dialog', () => {
    const open = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: 'Edit photo order' }));
      return screen.findByRole('dialog', { name: 'Edit Photo Order' });
    };

    it('moves a photo with the keyboard and saves the new order', async () => {
      const { user, onChange } = setup([photo('a'), photo('b'), photo('c')]);
      const dialog = await open(user);
      expect(within(dialog).getByRole('button', { name: 'Move a.jpg earlier' })).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: 'Move c.jpg later' })).toBeDisabled();
      const later = within(dialog).getByRole('button', { name: 'Move a.jpg later' });
      later.focus();
      await user.keyboard('{Enter}');
      expect(within(dialog).getByRole('status')).toHaveTextContent(
        'a.jpg moved to position 2 of 3',
      );
      // The focus stays on the moved photo's same button.
      await waitFor(() =>
        expect(within(dialog).getByRole('button', { name: 'Move a.jpg later' })).toHaveFocus(),
      );
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(onChange).toHaveBeenLastCalledWith(['b', 'a', 'c'].map(photo));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(names()).toEqual(['b.jpg', 'a.jpg', 'c.jpg']);
    });

    it('moves the focus to the other button when a photo reaches an end', async () => {
      const { user } = setup([photo('a'), photo('b')]);
      const dialog = await open(user);
      await user.click(within(dialog).getByRole('button', { name: 'Move a.jpg later' }));
      await waitFor(() =>
        expect(within(dialog).getByRole('button', { name: 'Move a.jpg earlier' })).toHaveFocus(),
      );
    });

    it('drops a dragged photo into place', async () => {
      const { user, onChange } = setup([photo('a'), photo('b'), photo('c')]);
      const dialog = await open(user);
      const items = within(dialog).getAllByRole('listitem');
      const data = { setData: vi.fn(), effectAllowed: '' };
      fireEvent.dragStart(items[0], { dataTransfer: data });
      fireEvent.dragOver(items[2], { dataTransfer: data });
      fireEvent.drop(items[2], { dataTransfer: data });
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(onChange).toHaveBeenLastCalledWith(['b', 'c', 'a'].map(photo));
    });

    it('keeps the order when cancelled and starts fresh on the next opening', async () => {
      const { user, onChange } = setup([photo('a'), photo('b')]);
      let dialog = await open(user);
      expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
      await user.click(within(dialog).getByRole('button', { name: 'Move a.jpg later' }));
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(onChange).not.toHaveBeenCalled();
      dialog = await open(user);
      expect(
        within(dialog)
          .getAllByRole('img')
          .map((el) => el.getAttribute('aria-label')),
      ).toEqual(['Photo 1: a.jpg', 'Photo 2: b.jpg']);
    });

    it('closes on Escape without changing the order', async () => {
      const { user, onChange } = setup([photo('a'), photo('b')]);
      await open(user);
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
