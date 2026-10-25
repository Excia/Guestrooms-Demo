import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { useRef, type KeyboardEvent, type PointerEvent, type Ref } from 'react';
import {
  dialPoint,
  fromClockParts,
  hourAngle,
  hourAtAngle,
  hourHasAllowed,
  minuteAngle,
  minuteAtAngle,
  pointAngle,
  stepHour,
  stepMinute,
  type ClockParts,
  type IsAllowed,
} from '../../app/clockTime';

export type ClockMode = 'hours' | 'minutes';

export interface ClockDialProps {
  mode: ClockMode;
  parts: ClockParts;
  step: number;
  isAllowed: IsAllowed;
  onChange: (next: ClockParts) => void;
  /** Hour chosen (pointer released or Enter): the picker moves on to the minutes. */
  onHourDone: () => void;
  /** Enter on the minutes face: accept the time. */
  onMinuteDone: () => void;
  ref?: Ref<SVGSVGElement>;
}

const SIZE = 240;
const CENTRE = SIZE / 2;
const LABEL_RADIUS = 88;
const HAND_RADIUS = LABEL_RADIUS;
const BUBBLE_RADIUS = 20;

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTE_LABELS = Array.from({ length: 12 }, (_, i) => i * 5);

/**
 * Analog dial (SVG, theme colours): the hour face, then the minute face. One slider for assistive
 * technology: arrows step the value, Home/End jump, Enter moves on or accepts. A drag or click on
 * the dial picks the nearest value; values with no allowed time are greyed and skipped.
 */
export default function ClockDial({
  mode,
  parts,
  step,
  isAllowed,
  onChange,
  onHourDone,
  onMinuteDone,
  ref,
}: ClockDialProps) {
  const theme = useTheme();
  const dragging = useRef(false);
  const hours = mode === 'hours';
  const value = hours ? parts.hour : parts.minute;
  const angle = hours ? hourAngle(parts.hour) : minuteAngle(parts.minute);
  const hand = dialPoint(angle, HAND_RADIUS, CENTRE);

  const minuteOk = (minute: number) => isAllowed(fromClockParts({ ...parts, minute }));
  const hourOk = (hour: number) => hourHasAllowed(hour, parts.pm, step, isAllowed);

  const choose = (next: number) => {
    if (hours) {
      if (!hourOk(next)) return false;
      // Keep the minute when it stays allowed, otherwise the first allowed one in that hour.
      const keep = { ...parts, hour: next };
      const minute = isAllowed(fromClockParts(keep))
        ? parts.minute
        : (Array.from({ length: 60 / step }, (_, i) => i * step).find((m) =>
            isAllowed(fromClockParts({ ...keep, minute: m })),
          ) ?? parts.minute);
      onChange({ ...keep, minute });
      return true;
    }
    if (!minuteOk(next)) return false;
    onChange({ ...parts, minute: next });
    return true;
  };

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return false;
    const scale = SIZE / rect.width;
    const a = pointAngle(
      (e.clientX - rect.left) * scale - CENTRE,
      (e.clientY - rect.top) * scale - CENTRE,
    );
    return choose(hours ? hourAtAngle(a) : minuteAtAngle(a, step));
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const dir =
      e.key === 'ArrowUp' || e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowDown' || e.key === 'ArrowLeft'
          ? -1
          : 0;
    if (dir) {
      e.preventDefault();
      const next = hours
        ? stepHour(parts, dir, step, isAllowed)
        : stepMinute(parts, dir, step, isAllowed);
      if (next !== null) choose(next);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const candidates = hours ? HOURS : Array.from({ length: 60 / step }, (_, i) => i * step);
      const ok = candidates.filter(hours ? hourOk : minuteOk);
      const target = e.key === 'Home' ? ok[0] : ok[ok.length - 1];
      if (target !== undefined) choose(target);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (hours) onHourDone();
      else onMinuteDone();
    }
  };

  const valueText = hours ? `${parts.hour} o'clock` : `${parts.minute} minutes`;

  return (
    <Box
      component="svg"
      ref={ref}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="slider"
      tabIndex={0}
      aria-label={hours ? 'Hours' : 'Minutes'}
      aria-orientation="horizontal"
      aria-valuemin={hours ? 1 : 0}
      aria-valuemax={hours ? 12 : 60 - step}
      aria-valuenow={value}
      aria-valuetext={valueText}
      onKeyDown={onKeyDown}
      onPointerDown={(e: PointerEvent<SVGSVGElement>) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        pick(e);
      }}
      onPointerMove={(e: PointerEvent<SVGSVGElement>) => {
        if (dragging.current) pick(e);
      }}
      onPointerUp={() => {
        if (!dragging.current) return;
        dragging.current = false;
        if (hours) onHourDone();
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      sx={{
        width: SIZE,
        height: SIZE,
        display: 'block',
        touchAction: 'none',
        cursor: 'pointer',
        userSelect: 'none',
        borderRadius: '50%',
        '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
      }}
    >
      <circle cx={CENTRE} cy={CENTRE} r={CENTRE} fill={theme.palette.action.hover} />
      <line
        x1={CENTRE}
        y1={CENTRE}
        x2={hand.x}
        y2={hand.y}
        stroke={theme.palette.primary.main}
        strokeWidth={2}
      />
      <circle cx={CENTRE} cy={CENTRE} r={3} fill={theme.palette.primary.main} />
      {(hours ? HOURS : MINUTE_LABELS).map((n) => {
        const a = hours ? hourAngle(n) : minuteAngle(n);
        const p = dialPoint(a, LABEL_RADIUS, CENTRE);
        const selected = hours ? n === parts.hour : n === parts.minute;
        const ok = hours ? hourOk(n) : minuteOk(n);
        return (
          <g key={n} data-value={n} aria-hidden="true">
            {selected ? (
              <circle cx={p.x} cy={p.y} r={BUBBLE_RADIUS} fill={theme.palette.primary.main} />
            ) : null}
            <text
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily={theme.typography.fontFamily}
              fontSize={theme.typography.body1.fontSize}
              fill={
                selected
                  ? theme.palette.primary.contrastText
                  : ok
                    ? theme.palette.text.primary
                    : theme.palette.text.disabled
              }
            >
              {hours ? n : String(n).padStart(2, '0')}
            </text>
          </g>
        );
      })}
      {/* A minute between the labelled ones (step below 5) shows as a small dot on the hand. */}
      {!hours && parts.minute % 5 !== 0 ? (
        <circle cx={hand.x} cy={hand.y} r={4} fill={theme.palette.primary.main} />
      ) : null}
    </Box>
  );
}
