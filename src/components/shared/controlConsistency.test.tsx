import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import ReservationListToolbar from '../reservationList/ReservationListToolbar';
import ScheduleControls from '../schedule/ScheduleControls';
import { theme } from '../../theme';
import { FIELD_HEIGHT_PX, TOOLBAR_FIELD_SIZE, TOOLBAR_FIELD_WIDTH } from './controlSizes';
import DateField from './DateField';
import NightAuditButton from './NightAuditButton';
import Pagination from './Pagination';
import Select from './Select';

const TODAY = '2026-10-16';
const wrap = (ui: ReactNode) =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  );

const schedule = () =>
  wrap(
    <ScheduleControls
      days={7}
      start={TODAY}
      today={TODAY}
      availability="all"
      activeFilters={0}
      filtersOpen={false}
      onDays={() => {}}
      onShift={() => {}}
      onStart={() => {}}
      onToday={() => {}}
      onAvailability={() => {}}
      onToggleFilters={() => {}}
      onNewReservation={() => {}}
    />,
  );

const list = () =>
  wrap(
    <ReservationListToolbar
      today={TODAY}
      checkInFrom=""
      checkInTo=""
      onDates={() => {}}
      unassignedOnly={false}
      onUnassignedOnly={() => {}}
      locations={[
        { id: 'a', name: 'Main Clubhouse' },
        { id: 'b', name: 'Lodge' },
      ]}
      locationIds={[]}
      onLocations={() => {}}
      onNewReservation={() => {}}
    />,
  );

describe('Night Audit button', () => {
  it('is the same button on the Schedule and the Reservation List', () => {
    const a = schedule();
    const onSchedule = screen.getByRole('link', { name: 'Night Audit' });
    const scheduleClass = onSchedule.className;
    const scheduleLabel = onSchedule.textContent;
    a.unmount();
    list();
    const onList = screen.getByRole('link', { name: 'Night Audit' });
    expect(onList.className).toBe(scheduleClass);
    expect(onList.textContent).toBe(scheduleLabel);
    expect(onList).toHaveClass('MuiButton-contained', 'MuiButton-colorInfo', 'MuiButton-sizeLarge');
    expect(onList).toHaveStyle({ minWidth: '200px', whiteSpace: 'nowrap' });
    expect(onList.querySelector('[data-testid="ShieldMoonIcon"]')).not.toBeNull();
  });

  it('renders standalone with the audit route', () => {
    wrap(<NightAuditButton />);
    expect(screen.getByRole('link', { name: 'Night Audit' })).toHaveAttribute('href');
  });
});

describe('toolbar control sizing standard', () => {
  const root = (el: HTMLElement) => el.closest('.MuiFormControl-root') as HTMLElement;
  const small = 'MuiInputBase-sizeSmall';

  it('Schedule View select uses the toolbar size and width', () => {
    schedule();
    const view = root(screen.getByRole('combobox', { name: 'View' }));
    expect(view.querySelector('.MuiInputBase-root')).toHaveClass(small);
    expect(view).toHaveStyle({ width: `${TOOLBAR_FIELD_WIDTH.select * 8}px` });
  });

  it('Reservation List date and location fields use the same toolbar size', () => {
    list();
    for (const name of ['Check in From', 'Check in to']) {
      const field = root(screen.getByLabelText(name));
      expect(field.querySelector('.MuiInputBase-root')).toHaveClass(small);
      expect(field).toHaveStyle({ width: `${TOOLBAR_FIELD_WIDTH.date * 8}px` });
    }
    const location = root(screen.getByRole('combobox', { name: 'Location' }));
    expect(location.querySelector('.MuiInputBase-root')).toHaveClass(small);
    expect(location).toHaveStyle({ width: `${TOOLBAR_FIELD_WIDTH.wideSelect * 8}px` });
  });

  it('records one scale: small 40px for toolbars, medium 56px for forms', () => {
    expect(TOOLBAR_FIELD_SIZE).toBe('small');
    expect(FIELD_HEIGHT_PX).toEqual({ small: 40, medium: 56 });
  });
});

describe('equal field heights', () => {
  const rootOf = (el: HTMLElement) => el.closest('.MuiInputBase-root') as HTMLElement;

  it('Select and DateField at size small are both exactly the small height', () => {
    schedule();
    const view = rootOf(screen.getByRole('combobox', { name: 'View' }));
    expect(view).toHaveStyle({ height: `${FIELD_HEIGHT_PX.small}px` });
    list();
    for (const name of ['Check in From', 'Check in to', 'Location']) {
      const el = screen.getByLabelText(name, { selector: 'input,[role=combobox]' });
      expect(rootOf(el)).toHaveStyle({ height: `${FIELD_HEIGHT_PX.small}px` });
    }
  });

  it('medium outlined fields are exactly the medium height', () => {
    wrap(
      <>
        <Select label="Pick" value="a" options={[{ value: 'a', label: 'A' }]} onChange={() => {}} />
        <DateField label="Day" value="" today={TODAY} />
      </>,
    );
    expect(rootOf(screen.getByRole('combobox', { name: 'Pick' }))).toHaveStyle({
      height: `${FIELD_HEIGHT_PX.medium}px`,
    });
    expect(rootOf(screen.getByLabelText('Day'))).toHaveStyle({
      height: `${FIELD_HEIGHT_PX.medium}px`,
    });
  });

  it('draws the rows-per-page select of the pager as an outlined toolbar field', () => {
    wrap(<Pagination page={1} rowsPerPage={10} total={50} onChange={() => {}} />);
    const root = rootOf(screen.getByRole('combobox', { name: /rows per page/i }));
    expect(root).toHaveClass('MuiOutlinedInput-root');
    expect(root).toHaveStyle({ height: `${FIELD_HEIGHT_PX.small}px` });
  });
});
