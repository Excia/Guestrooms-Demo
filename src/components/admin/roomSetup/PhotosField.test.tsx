import { ThemeProvider } from '@mui/material/styles';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ApiProvider } from '../../../api';
import { createMockClient } from '../../../api/mock';
import type { ApiClient, RoomPhoto } from '../../../api/types';
import { DELETE_ARM_MS, DELETE_LAPSE_MS } from '../../../app/photos';
import { ReadOnlyContext } from '../../../app/readOnlyContext';
import { theme } from '../../../theme';
import PhotosField from './PhotosField';
import { photoFile } from './photoTestFiles';

const photo = (id: string): RoomPhoto => ({ id, name: `${id}.jpg`, url: '' });

function Harness({
  initial,
  onChange,
  entityId = 'room-1',
}: {
  initial: RoomPhoto[];
  onChange?: (p: RoomPhoto[]) => void;
  entityId?: string;
}) {
  const [photos, setPhotos] = useState(initial);
  return (
    <>
      <button type="button" onClick={() => setPhotos(initial)}>
        Discard changes
      </button>
      <PhotosField
        key={entityId}
        owner="room"
        entityId={entityId}
        photos={photos}
        onChange={(next) => {
          setPhotos(next);
          onChange?.(next);
        }}
      />
    </>
  );
}

function setup(
  initial: RoomPhoto[] = [],
  client: ApiClient = createMockClient({ latencyMs: 0 }),
  readOnly = false,
  entityId?: string,
) {
  const onChange = vi.fn();
  const user = userEvent.setup({ applyAccept: false });
  const ui = (id?: string) => (
    <ApiProvider client={client}>
      <ThemeProvider theme={theme}>
        <ReadOnlyContext.Provider value={{ readOnly, baseTheme: null }}>
          <Harness initial={initial} onChange={onChange} entityId={id ?? entityId} />
        </ReadOnlyContext.Provider>
      </ThemeProvider>
    </ApiProvider>
  );
  const view = render(ui());
  return { user, onChange, client, rerenderWith: (id: string) => view.rerender(ui(id)), view };
}

const names = () =>
  within(screen.getByRole('list', { name: 'Photos' }))
    .getAllByRole('img')
    .map((el) => el.getAttribute('aria-label'));
const input = () => screen.getByLabelText('Photo files');
const file = photoFile;

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

  describe('preview URLs', () => {
    const created: string[] = [];
    const revoke = vi.fn();
    beforeEach(() => {
      created.length = 0;
      revoke.mockClear();
      let n = 0;
      URL.createObjectURL = vi.fn(() => {
        const url = `blob:test-${++n}`;
        created.push(url);
        return url;
      });
      URL.revokeObjectURL = revoke;
    });

    it('revokes a preview URL when its photo is removed', async () => {
      const { user } = setup();
      await user.upload(input(), [file('b.png')]);
      await waitFor(() => expect(names()).toEqual(['b.png']));
      await user.click(screen.getByRole('button', { name: 'Remove photo b.png' }));
      const confirm = screen.getByRole('button', { name: 'Confirm remove photo b.png' });
      await waitFor(() => expect(confirm).toHaveAttribute('aria-disabled', 'false'));
      await user.click(confirm);
      await waitFor(() => expect(revoke).toHaveBeenCalledWith(created[0]));
    });

    it('revokes the previews when the draft is discarded', async () => {
      const { user } = setup();
      await user.upload(input(), [file('b.png'), file('c.png')]);
      await waitFor(() => expect(names()).toHaveLength(2));
      expect(revoke).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: 'Discard changes' }));
      await waitFor(() => expect(revoke).toHaveBeenCalledTimes(2));
      expect(revoke.mock.calls.map((c) => c[0]).sort()).toEqual([...created].sort());
    });

    it('revokes the previews when the field goes away', async () => {
      const { user, view } = setup();
      await user.upload(input(), [file('b.png')]);
      await waitFor(() => expect(names()).toEqual(['b.png']));
      view.unmount();
      expect(revoke).toHaveBeenCalledWith(created[0]);
    });
  });

  describe('file names and content', () => {
    it('stores and sends the sanitized name of a path-like or special-character file', async () => {
      const client = createMockClient({ latencyMs: 0 });
      const upload = vi.spyOn(client.photos, 'upload');
      const { user } = setup([], client);
      await user.upload(input(), [
        file('../../etc/my photo (1).png'),
        file('C:\\temp\\<x>é.jpg', 'image/jpeg'),
      ]);
      await waitFor(() => expect(names()).toEqual(['myphoto1.png', 'x.jpg']));
      expect(upload.mock.calls[0][0].files.map((f) => f.name)).toEqual(['myphoto1.png', 'x.jpg']);
    });

    it('refuses a name that is nothing but special characters', async () => {
      const { user } = setup();
      await user.upload(input(), [file('???.png')]);
      expect(await screen.findByRole('alert')).toHaveTextContent('???.png');
    });

    it('refuses a wrong extension even with an image type', async () => {
      const { user } = setup();
      await user.upload(input(), [file('a.gif')]);
      expect(await screen.findByRole('alert')).toHaveTextContent('a.gif');
      expect(screen.getByText('No photos')).toBeVisible();
    });

    it('refuses a file whose first bytes are not the image it claims to be', async () => {
      const client = createMockClient({ latencyMs: 0 });
      const upload = vi.spyOn(client.photos, 'upload');
      const { user } = setup([], client);
      await user.upload(input(), [
        file('fake.png', 'image/png', 1000, [0x68, 0x65, 0x6c, 0x6c, 0x6f]),
        file('swapped.jpg', 'image/jpeg', 1000, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ]);
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('fake.png is not a valid JPG or PNG image.');
      expect(alert).toHaveTextContent('swapped.jpg is not a valid JPG or PNG image.');
      expect(upload).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Add photos' })).toBeEnabled();
    });

    it('treats an answer with the wrong number of photos as a failed upload', async () => {
      const client = createMockClient({ latencyMs: 0 });
      vi.spyOn(client.photos, 'upload').mockResolvedValue([]);
      const { user, onChange } = setup([], client);
      await user.upload(input(), [file('a.png')]);
      expect(await screen.findByRole('alert')).toHaveTextContent('could not be uploaded');
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('changing record while uploading', () => {
    it('drops an upload that finishes after the record changed', async () => {
      const client = createMockClient({ latencyMs: 0 });
      let finish: (p: RoomPhoto[]) => void = () => undefined;
      let signal: AbortSignal | undefined;
      vi.spyOn(client.photos, 'upload').mockImplementation((_req, o) => {
        signal = o?.signal;
        return new Promise<RoomPhoto[]>((resolve) => {
          finish = resolve;
        });
      });
      const { user, onChange, rerenderWith } = setup([], client, false, 'room-1');
      await user.upload(input(), [file('a.png')]);
      await screen.findByRole('button', { name: 'Uploading…' });
      rerenderWith('room-2');
      expect(signal?.aborted).toBe(true);
      await act(async () => finish([photo('a')]));
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByText('No photos')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Add photos' })).toBeEnabled();
    });
  });

  describe('focus and announcements after delete', () => {
    const remove = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
      await user.click(screen.getByRole('button', { name: `Remove photo ${name}` }));
      const confirm = screen.getByRole('button', { name: `Confirm remove photo ${name}` });
      await waitFor(() => expect(confirm).toHaveAttribute('aria-disabled', 'false'));
      await user.click(confirm);
    };

    it('announces that Delete is armed and that the photo was removed', async () => {
      const { user } = setup([photo('a'), photo('b')]);
      await user.click(screen.getByRole('button', { name: 'Remove photo a.jpg' }));
      expect(screen.getByRole('status')).toHaveTextContent(
        'Press Delete to remove a.jpg, or Escape to cancel',
      );
      await user.keyboard('{Escape}');
      await remove(user, 'a.jpg');
      expect(screen.getByRole('status')).toHaveTextContent('Photo removed');
    });

    it('moves the focus to the next photo, else the previous, else Add photos', async () => {
      const { user } = setup([photo('a'), photo('b'), photo('c')]);
      await remove(user, 'b.jpg');
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Remove photo c.jpg' })).toHaveFocus(),
      );
      await remove(user, 'c.jpg');
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Remove photo a.jpg' })).toHaveFocus(),
      );
      await remove(user, 'a.jpg');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Add photos' })).toHaveFocus());
    });

    it('gives the focus back to the remove button when an armed Delete lapses', () => {
      vi.useFakeTimers();
      setup([photo('a')]);
      fireEvent.click(screen.getByRole('button', { name: 'Remove photo a.jpg' }));
      expect(screen.getByRole('button', { name: 'Confirm remove photo a.jpg' })).toHaveFocus();
      act(() => void vi.advanceTimersByTime(DELETE_LAPSE_MS));
      expect(screen.getByRole('button', { name: 'Remove photo a.jpg' })).toHaveFocus();
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
