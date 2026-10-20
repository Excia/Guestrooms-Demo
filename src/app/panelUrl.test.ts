import { applyPanel, closePanel, parsePanel } from './panelUrl';
import { applyScheduleView, parseScheduleView } from './scheduleUrl';

const p = (s: string) => new URLSearchParams(s);

describe('panel URL state', () => {
  it('parses details, details with a room, and the new reservation panel', () => {
    expect(parsePanel(p('res=rs-2'))).toEqual({ kind: 'details', reservationId: 'rs-2' });
    expect(parsePanel(p('res=rs-2&rr=rr-2'))).toEqual({
      kind: 'details',
      reservationId: 'rs-2',
      reservationRoomId: 'rr-2',
    });
    expect(parsePanel(p('panel=new'))).toEqual({ kind: 'new' });
    expect(parsePanel(p(''))).toBeNull();
  });

  it('the new panel wins over a stray res parameter', () => {
    expect(parsePanel(p('panel=new&res=rs-2'))).toEqual({ kind: 'new' });
  });

  it('ignores unusable ids and unknown panel values', () => {
    for (const bad of ['res=', 'res=..', 'res=.', `res=${'x'.repeat(129)}`, 'res=%20']) {
      expect(parsePanel(p(bad))).toBeNull();
    }
    expect(parsePanel(p('panel=other'))).toBeNull();
    expect(parsePanel(p('res=rs-2&rr=..'))).toEqual({ kind: 'details', reservationId: 'rs-2' });
  });

  it('opening replaces the previous panel and keeps every other parameter', () => {
    const base = p('start=2026-11-02&view=14&locations=lakeside&mock=error&res=rs-1&rr=rr-1');
    const next = applyPanel(base, { kind: 'new' });
    expect(next.get('panel')).toBe('new');
    expect(next.get('res')).toBeNull();
    expect(next.get('rr')).toBeNull();
    expect(next.get('start')).toBe('2026-11-02');
    expect(next.get('mock')).toBe('error');
  });

  it('closing (and Back to schedule) restores the exact view: dates, length and filters', () => {
    const view = p(
      'start=2026-11-02&view=30&locations=lakeside,north-lodge&types=suite&rooms=booked',
    );
    const open = applyPanel(view, {
      kind: 'details',
      reservationId: 'rs-2',
      reservationRoomId: 'rr-2',
    });
    const closed = closePanel(open);
    expect(parseScheduleView(closed)).toEqual(parseScheduleView(view));
    expect(closed.toString()).toBe(view.toString());
  });

  it('changing the schedule view while the panel is open keeps the panel', () => {
    const open = applyPanel(p('res=rs-2'), { kind: 'details', reservationId: 'rs-2' });
    const view = { ...parseScheduleView(open), days: 14 as const };
    expect(parsePanel(applyScheduleView(open, view))).toEqual({
      kind: 'details',
      reservationId: 'rs-2',
    });
  });
});
