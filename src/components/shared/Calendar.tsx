import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { rangeShade, type RangeValue } from '../../app/dateRange';
import {
  clampDate,
  dayLabel,
  monthGrid,
  monthHasEnabledDay,
  monthTitle,
  moveFocus,
  shiftMonths,
  weekdayHeaders,
  type WeekStartDay,
} from '../../lib/calendar';
import { monthOf, type IsoDate } from '../../lib/dates';

export interface CalendarHandle {
  /** Puts the keyboard focus on the current day button (call once the popover has focused itself). */
  focusDay: () => void;
}

export interface CalendarProps {
  /** Selected day(s): `to` is '' in single mode and while the second date of a range is pending. */
  value: RangeValue;
  /** Single picks one day (value.from); range highlights from..to. */
  mode: 'single' | 'range';
  today: IsoDate;
  /** Day that holds the keyboard focus when the calendar opens. */
  initialFocus: IsoDate;
  min?: IsoDate;
  max?: IsoDate;
  isDisabled: (day: IsoDate) => boolean;
  onSelect: (day: IsoDate) => void;
  weekStartsOn?: WeekStartDay;
  /** Names the ends in the day buttons, e.g. ['check-in', 'check-out']. */
  endNames?: [string, string];
  ref?: Ref<CalendarHandle>;
}

/**
 * Themed month calendar (WAI-ARIA date grid): arrows move by day and week, Home/End to the week
 * ends, PageUp/PageDown by month (Shift: year). Selected days use the primary color, days inside a
 * range the primary tint. The hover/keyboard preview of a pending range is visual only.
 */
export default function Calendar({
  value,
  mode,
  today,
  initialFocus,
  min,
  max,
  isDisabled,
  onSelect,
  weekStartsOn = 0,
  endNames,
  ref,
}: CalendarProps) {
  const titleId = useId();
  const [focused, setFocused] = useState<IsoDate>(initialFocus);
  const [hover, setHover] = useState<IsoDate | null>(null);
  const gridRef = useRef<HTMLTableElement>(null);
  const focusRequested = useRef(false);
  const month = monthOf(focused);
  const weeks = monthGrid(month, weekStartsOn);
  const headers = weekdayHeaders(weekStartsOn);

  const focusDay = () =>
    gridRef.current
      ?.querySelector<HTMLElement>('button[tabindex="0"]')
      ?.focus({ preventScroll: true });
  useImperativeHandle(ref, () => ({ focusDay }));

  // The modal's focus trap focuses the dialog first (it runs after this mount), so take focus on the
  // next frame; the popover's onEntered asks again in case the first attempt came too early.
  useEffect(() => {
    const frame = requestAnimationFrame(focusDay);
    return () => cancelAnimationFrame(frame);
  }, []);

  // After a keyboard move the roving tabindex moves; the month buttons keep their own focus.
  useEffect(() => {
    if (!focusRequested.current) return;
    focusRequested.current = false;
    focusDay();
  }, [focused]);

  const go = (day: IsoDate) => setFocused(clampDate(day, min, max));
  const monthOpen = (delta: number) => {
    const m = monthOf(shiftMonths(`${month}-01`, delta));
    const inBounds = (!min || m >= monthOf(min)) && (!max || m <= monthOf(max));
    return inBounds && monthHasEnabledDay(m, isDisabled);
  };
  const canPrev = monthOpen(-1);
  const canNext = monthOpen(1);
  const preview = hover ?? (mode === 'range' ? focused : null);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = moveFocus(focused, event.key, event.shiftKey, weekStartsOn);
    if (next === null) return;
    event.preventDefault();
    setHover(null);
    focusRequested.current = true;
    go(next);
  };

  const previewDay = preview && !isDisabled(preview) ? preview : null;
  const rangeEnd =
    mode === 'range'
      ? value.to || (previewDay && value.from && previewDay > value.from ? previewDay : '')
      : '';

  // aria-disabled (not `disabled`) keeps the focus on the month button when it reaches the limit.
  const monthButton = (delta: -1 | 1, can: boolean) => (
    <IconButton
      size="small"
      aria-label={delta < 0 ? 'Previous month' : 'Next month'}
      aria-disabled={!can || undefined}
      className={can ? undefined : 'Mui-disabled'}
      sx={can ? undefined : { '&.Mui-disabled': { pointerEvents: 'auto', cursor: 'default' } }}
      onClick={() => {
        if (can) go(shiftMonths(focused, delta));
      }}
    >
      {delta < 0 ? <ChevronLeft /> : <ChevronRight />}
    </IconButton>
  );

  return (
    <Box sx={{ width: (t) => t.spacing(35) }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        {monthButton(-1, canPrev)}
        <Typography id={titleId} variant="subtitle1" component="div" aria-live="polite">
          {monthTitle(month)}
        </Typography>
        {monthButton(1, canNext)}
      </Box>
      <Box
        component="table"
        role="grid"
        ref={gridRef}
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        sx={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%' }}
      >
        <thead>
          <tr>
            {headers.map((h) => (
              <Box
                component="th"
                scope="col"
                key={h.long}
                sx={(t) => ({
                  ...t.typography.caption,
                  color: t.palette.text.secondary,
                  fontWeight: t.typography.fontWeightMedium,
                  height: t.spacing(4),
                  p: 0,
                })}
              >
                <span aria-hidden>{h.short}</span>
                <Box component="span" sx={visuallyHidden}>
                  {h.long}
                </Box>
              </Box>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((day, i) => {
                if (!day) return <td key={`blank-${i}`} />;
                const disabled = isDisabled(day);
                // What is really selected (announced) versus what is only previewed (visual).
                const isStart = day === value.from;
                const isEnd = mode === 'range' && day === value.to;
                const between =
                  mode === 'range' &&
                  Boolean(value.from && value.to) &&
                  day > value.from &&
                  day < value.to;
                const selected = isStart || isEnd || between;
                const shade =
                  mode === 'range' ? rangeShade(day, value, previewDay) : isStart ? 'start' : null;
                const endpoint = shade === 'start' || shade === 'end';
                const isToday = day === today;
                const endName =
                  mode === 'range' && endNames
                    ? isStart
                      ? endNames[0]
                      : isEnd
                        ? endNames[1]
                        : null
                    : null;
                return (
                  <Box
                    component="td"
                    key={day}
                    role="gridcell"
                    aria-selected={selected}
                    sx={(t) => ({
                      p: 0,
                      textAlign: 'center',
                      // The in-range band runs through the cell edges so the days read as one strip.
                      backgroundColor:
                        shade === 'between' || (rangeEnd && endpoint)
                          ? t.palette.primary.tint
                          : undefined,
                      borderRadius:
                        shade === 'start'
                          ? `${t.spacing(2.5)} 0 0 ${t.spacing(2.5)}`
                          : shade === 'end'
                            ? `0 ${t.spacing(2.5)} ${t.spacing(2.5)} 0`
                            : undefined,
                    })}
                  >
                    <ButtonBase
                      tabIndex={day === focused ? 0 : -1}
                      aria-disabled={disabled || undefined}
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={`${dayLabel(day)}${isToday ? ', today' : ''}${endName ? `, ${endName}` : ''}`}
                      onClick={(event) => {
                        // Safari does not focus a button on click; keep the roving focus on it.
                        event.currentTarget.focus();
                        setFocused(day);
                        if (!disabled) onSelect(day);
                      }}
                      onMouseEnter={() => setHover(day)}
                      onMouseLeave={() => setHover(null)}
                      sx={(t) => ({
                        ...t.typography.body2,
                        width: t.spacing(5),
                        height: t.spacing(5),
                        borderRadius: '50%',
                        color: disabled ? t.palette.text.disabled : t.palette.text.primary,
                        cursor: disabled ? 'default' : 'pointer',
                        border: `1px solid ${isToday && !endpoint ? t.palette.primary.main : 'transparent'}`,
                        ...(endpoint && {
                          backgroundColor: t.palette.primary.main,
                          color: t.palette.primary.contrastText,
                          fontWeight: t.typography.fontWeightMedium,
                          '&:hover': { backgroundColor: t.palette.primary.dark },
                        }),
                        // Tint on the tinted band would vanish, so a hovered in-range day gets a ring.
                        ...(!endpoint &&
                          !disabled && {
                            '&:hover': {
                              backgroundColor: t.palette.primary.tint,
                              ...(shade === 'between' && {
                                borderColor: t.palette.primary.outlinedBorder,
                              }),
                            },
                          }),
                        ...(disabled &&
                          !endpoint && { '&:hover': { backgroundColor: 'transparent' } }),
                      })}
                    >
                      {Number(day.slice(8))}
                    </ButtonBase>
                  </Box>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}
