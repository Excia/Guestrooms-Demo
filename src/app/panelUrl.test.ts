import { applyPanel, closePanel, parsePanel } from './panelUrl';
import { applyScheduleView, parseScheduleView } from './scheduleUrl';

const p = (s: string) => new URLSearchParams(s);

describe('panel URL state: prefilled New Reservation', () => {
  it('parses the room and the arrival tolerantly', () => {
    expect(parsePanel(p('panel=new&room=rm-203&arrival=2026-10-20'))).toEqual({
      kind: 'new',
      roomId: 'rm-203',
      arrival: '2026-10-20',
    });
    expect(parsePanel(p('panel=new&room=..&arrival=nonsense'))).toEqual({ kind: 'new' });
    expect(parsePanel(p('panel=new&arrival=2026-02-31'))).toEqual({ kind: 'new' });
    // without panel=new they mean nothing
    expect(parsePanel(p('room=rm-203&arrival=2026-10-20'))).toBeNull();
  });

  it('applies them, drops them when switching panel, and Back to schedule restores the view', () => {
    const view = p('start=2026-11-02&view=14&locations=lakeside');
    const open = applyPanel(view, { kind: 'new', roomId: 'rm-203', arrival: '2026-11-03' });
    expect(open.get('room')).toBe('rm-203');
    expect(open.get('arrival')).toBe('2026-11-03');
    expect(applyPanel(open, { kind: 'details', reservationId: 'rs-1' }).get('room')).toBeNull();
    expect(closePanel(open).toString()).toBe(view.toString());
  });
});

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

describe('panel URL state: closures', () => {
  it('parses the closure tab with its prefill, tolerantly', () => {
    expect(
      parsePanel(
        p('panel=new&tab=closure&room=rm-208&arrival=2026-10-20&end=2026-10-22&desc=Paint'),
      ),
    ).toEqual({
      kind: 'new',
      tab: 'closure',
      roomId: 'rm-208',
      arrival: '2026-10-20',
      end: '2026-10-22',
      description: 'Paint',
    });
    expect(parsePanel(p('panel=new&tab=closure&end=nope&desc=' + 'x'.repeat(80)))).toEqual({
      kind: 'new',
      tab: 'closure',
      description: 'x'.repeat(50),
    });
    // end and desc mean nothing on the reservation tab
    expect(parsePanel(p('panel=new&end=2026-10-22&desc=Paint'))).toEqual({ kind: 'new' });
  });
  it('parses the closure details panel and ignores unsafe ids', () => {
    expect(parsePanel(p('closure=cl-1'))).toEqual({ kind: 'closure', closureId: 'cl-1' });
    expect(parsePanel(p('closure=..'))).toBeNull();
  });
  it('applies, replaces and closes without touching the view', () => {
    const view = p('start=2026-11-02&view=14');
    const open = applyPanel(view, { kind: 'closure', closureId: 'cl-1' });
    expect(open.get('closure')).toBe('cl-1');
    const next = applyPanel(open, {
      kind: 'new',
      tab: 'closure',
      end: '2026-11-05',
      description: 'A',
    });
    expect(next.get('closure')).toBeNull();
    expect(next.get('end')).toBe('2026-11-05');
    expect(applyPanel(next, { kind: 'new' }).get('tab')).toBeNull();
    expect(closePanel(next).toString()).toBe(view.toString());
  });
});
