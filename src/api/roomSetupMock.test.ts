import { ApiError } from './types';
import { createMockClient } from './mock';
import { blankRoom, blankRoomType } from '../app/roomSetup';

const photo = { id: 'p', name: 'a.jpg', url: '' };

describe('mock room setup API', () => {
  it('creates, edits and deletes a room type', async () => {
    const api = createMockClient().roomSetup;
    const options = await api.getOptions();
    const draft = { ...blankRoomType('2026-10-20', options), name: 'Suite' };
    draft.details.photos = [photo];
    const created = await api.saveRoomType(draft);
    expect(created.id).toBeTruthy();
    const renamed = await api.saveRoomType({ ...created, name: 'Big Suite' });
    expect((await api.listRoomTypes()).find((t) => t.id === created.id)?.name).toBe('Big Suite');
    expect(renamed.id).toBe(created.id);
    await api.deleteRoomType(created.id);
    expect((await api.listRoomTypes()).some((t) => t.id === created.id)).toBe(false);
  });

  it('rejects an invalid room type with 422 and a missing one with 404', async () => {
    const api = createMockClient().roomSetup;
    const options = await api.getOptions();
    await expect(api.saveRoomType(blankRoomType('2026-10-20', options))).rejects.toMatchObject({
      status: 422,
    });
    const [type] = await api.listRoomTypes();
    await expect(api.saveRoomType({ ...type, id: 'nope' })).rejects.toBeInstanceOf(ApiError);
    await expect(api.deleteRoomType('nope')).rejects.toMatchObject({ status: 404 });
  });

  it('refuses to delete a room type in use (409)', async () => {
    const api = createMockClient().roomSetup;
    await expect(api.deleteRoomType('rt-double-queen')).rejects.toMatchObject({
      status: 409,
      code: 'in-use',
    });
  });

  it('keeps linked rooms two-way and unlinks on delete', async () => {
    const api = createMockClient().roomSetup;
    const options = await api.getOptions();
    const types = await api.listRoomTypes();
    const created = await api.saveRoom({
      ...blankRoom('2026-10-20', options, types[0]),
      name: '300',
      linkedRoomIds: ['room-200'],
    });
    const rooms = await api.listRooms();
    expect(rooms.find((r) => r.id === 'room-200')?.linkedRoomIds).toEqual([created.id]);
    await api.deleteRoom(created.id);
    expect((await api.listRooms()).find((r) => r.id === 'room-200')?.linkedRoomIds).toEqual([]);
  });

  it('copies the room type details into a room that inherits them, and follows later edits', async () => {
    const api = createMockClient().roomSetup;
    const options = await api.getOptions();
    const types = await api.listRoomTypes();
    const room = await api.saveRoom({ ...blankRoom('2026-10-20', options, types[1]), name: '301' });
    expect(room.details.bedTypes['bed-king']).toBe(1);
    await api.saveRoomType({ ...types[1], details: { ...types[1].details, maxOccupancy: 7 } });
    expect((await api.listRooms()).find((r) => r.id === room.id)?.details.maxOccupancy).toBe(7);
  });

  it('answers with empty lists in the empty scenario', async () => {
    const api = createMockClient({ scenario: 'empty' }).roomSetup;
    expect(await api.listRoomTypes()).toEqual([]);
    expect(await api.listRooms()).toEqual([]);
  });
});
