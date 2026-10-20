import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useId, useRef, useState } from 'react';
import { rangeShade, type RangeValue } from '../../app/dateRange';
import {
  clampDate,
  dayLabel,
  monthGrid,
  monthTitle,
  moveFocus,
  shiftMonths,
  weekdayHeaders,
  type WeekStartDay,
} from '../../lib/calendar';
import { monthOf, type IsoDate } from '../../lib/dates';

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
}

/**
 * Themed month calendar (WAI-ARIA date grid): arrows move by day and week, Home/End to the week
 * ends, PageUp/PageDown by month (Shift: year). Selected days use the primary color, days inside a
 * range the primary tint.
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
}: CalendarProps) {
  const titleId = useId();
  const [focused, setFocused] = useState<IsoDate>(initialFocus);
  const [hover, setHover] = useState<IsoDate | null>(null);
  const gridRef = useRef<HTMLTableElement>(null);
  const focusRequested = useRef(true);
  const month = monthOf(focused);
  const weeks = monthGrid(month, weekStartsOn);
  const headers = weekdayHeaders(weekStartsOn);

  // Focus follows the roving tabindex on open and after a keyboard move, not after the month
  // buttons (they keep their own focus) and not on mouse hover.
  useEffect(() => {
    if (!focusRequested.current) return;
    focusRequested.current = false;
    gridRef.current
      ?.querySelector<HTMLElement>('button[tabindex="0"]')
      ?.focus({ preventScroll: true });
  }, [focused]);

  const go = (day: IsoDate) => setFocused(clampDate(day, min, max));
  const canPrev = !min || monthOf(min) < month;
  const canNext = !max || monthOf(max) > month;
  const preview = hover ?? (mode === 'range' ? focused : null);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const next = moveFocus(focused, event.key, event.shiftKey, weekStartsOn);
    if (next === null || event.altKey || event.ctrlKey || event.metaKey) return;
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

  return (
    <Box sx={{ width: (t) => t.spacing(35) }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <IconButton
          size="small"
          aria-label="Previous month"
          disabled={!canPrev}
          onClick={() => go(shiftMonths(focused, -1))}
        >
          <ChevronLeft />
        </IconButton>
        <Typography id={titleId} variant="subtitle1" component="div" aria-live="polite">
          {monthTitle(month)}
        </Typography>
        <IconButton
          size="small"
          aria-label="Next month"
          disabled={!canNext}
          onClick={() => go(shiftMonths(focused, 1))}
        >
          <ChevronRight />
        </IconButton>
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
                  fontWeight: 500,
                  height: t.spacing(4),
                  p: 0,
                })}
              >
                <abbr title={h.long} style={{ textDecoration: 'none' }}>
                  {h.short}
                </abbr>
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
                const shade =
                  mode === 'range'
                    ? rangeShade(day, value, previewDay)
                    : day === value.from
                      ? 'start'
                      : null;
                const selected = shade !== null;
                const endpoint = shade === 'start' || shade === 'end';
                const isToday = day === today;
                const endName =
                  mode === 'range' && endNames && endpoint
                    ? shade === 'start'
                      ? endNames[0]
                      : endNames[1]
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
                      onClick={() => {
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
                        border:
                          isToday && !endpoint
                            ? `1px solid ${t.palette.primary.main}`
                            : '1px solid transparent',
                        ...(endpoint && {
                          backgroundColor: t.palette.primary.main,
                          color: t.palette.primary.contrastText,
                          fontWeight: 500,
                          '&:hover': { backgroundColor: t.palette.primary.dark },
                        }),
                        ...(!endpoint &&
                          !disabled && { '&:hover': { backgroundColor: t.palette.primary.tint } }),
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
