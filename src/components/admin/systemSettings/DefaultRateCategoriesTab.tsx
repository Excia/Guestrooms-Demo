import AddCircle from '@mui/icons-material/AddCircle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import MenuItem from '@mui/material/MenuItem';
import MuiSelect from '@mui/material/Select';
import type { Theme } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@mui/utils';
import { useEffect, useRef, useState } from 'react';
import type { DefaultRateCategories, LookupRef } from '../../../api/types';
import {
  addMemberTypeOverride,
  DEFAULT_RATE_ROWS,
  overrideFieldKey,
  removeMemberTypeOverride,
  updateMemberTypeOverride,
  type DefaultRateKey,
} from '../../../app/defaultRateCategories';
import { useDisabled } from '../../../app/readOnlyContext';
import type { SystemSettingsErrors } from '../../../app/systemSettings';
import RemoveIconButton from '../../shared/RemoveIconButton';
import EditOnly from '../EditOnly';
import LegacyRemoveDialog from '../employees/LegacyRemoveDialog';
import { fieldId } from './fieldParts';

export interface DefaultRateCategoriesTabProps {
  value: DefaultRateCategories;
  onChange: (next: DefaultRateCategories) => void;
  rateCategories: readonly LookupRef[];
  memberTypes: readonly LookupRef[];
  errors: SystemSettingsErrors;
}

interface TableSelectProps {
  id: string;
  /** Accessible name of the select. */
  label: string;
  value: string | null;
  options: readonly (LookupRef & { disabled?: boolean })[];
  placeholder: string;
  onChange: (id: string) => void;
  error?: string;
}

// Dense outlined select of the legacy table (no visible label: the row text names it).
function TableSelect({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
  error,
}: TableSelectProps) {
  const errorId = `${id}-error`;
  // A saved id whose record is gone reads as "none chosen" rather than a blank box.
  const current = options.some((o) => o.id === value) ? (value ?? '') : '';
  return (
    <FormControl size="small" fullWidth error={Boolean(error)} disabled={useDisabled()}>
      <MuiSelect<string>
        id={id}
        value={current}
        displayEmpty
        renderValue={(v) => options.find((o) => o.id === v)?.label ?? placeholder}
        onChange={(e) => onChange(e.target.value)}
        SelectDisplayProps={{
          'aria-label': label,
          'aria-labelledby': undefined,
          'aria-describedby': error ? errorId : undefined,
        }}
        sx={{ '& .MuiSelect-select': { color: current ? 'text.primary' : 'text.secondary' } }}
      >
        {options.map((o) => (
          <MenuItem key={o.id} value={o.id} disabled={o.disabled}>
            {o.label}
          </MenuItem>
        ))}
      </MuiSelect>
      {error ? <FormHelperText id={errorId}>{error}</FormHelperText> : null}
    </FormControl>
  );
}

const cellSx = (t: Theme) => ({
  border: `1px solid ${t.palette.divider}`,
  px: 1,
  py: 1,
  verticalAlign: 'middle',
});

// Default Rate Categories tab (legacy DefaultRateCategoriesEdit.vue; no Figma frame, Q-71-1): the
// default rate category of room blocks, members, non-members and owners, and one override per
// member type. The page owns the draft, the one Save button and the leave prompt.
export default function DefaultRateCategoriesTab({
  value,
  onChange,
  rateCategories,
  memberTypes,
  errors,
}: DefaultRateCategoriesTabProps) {
  const nextId = useRef(1);
  const addButton = useRef<HTMLButtonElement>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const focusId = useRef<string | null>(null);

  // A new row takes focus once it is rendered.
  useEffect(() => {
    const id = focusId.current;
    if (!id) return;
    focusId.current = null;
    document.getElementById(fieldId(overrideFieldKey(id, 'memberTypeId')))?.focus();
  }, [value]);

  const setDefault = (key: DefaultRateKey, id: string) => onChange({ ...value, [key]: id });
  const taken = new Set(value.memberTypeOverrides.map((o) => o.memberTypeId));
  const typeLabel = (id: string | null) =>
    memberTypes.find((m) => m.id === id)?.label ?? 'new member type';

  return (
    <Box>
      <Typography variant="settings_heading" component="h3" sx={{ mb: 1 }}>
        Default Rate Categories
      </Typography>
      <Table
        aria-label="Default rate categories"
        sx={(t) => ({ width: 'auto', tableLayout: 'fixed', minWidth: t.spacing(60) })}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={cellSx}>
              <Box component="span" sx={visuallyHidden}>
                Applies to
              </Box>
            </TableCell>
            <TableCell
              scope="col"
              align="center"
              sx={(t) => ({ ...cellSx(t), fontWeight: 'bold' })}
            >
              Default Rate Category
            </TableCell>
            <TableCell sx={(t) => ({ border: 0, width: t.spacing(7) })}>
              <Box component="span" sx={visuallyHidden}>
                Remove
              </Box>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {DEFAULT_RATE_ROWS.map((row) => (
            <TableRow key={row.key}>
              <TableCell component="th" scope="row" sx={(t) => ({ ...cellSx(t), fontWeight: 400 })}>
                <Typography variant="settings_body" component="p">
                  {row.label}
                </Typography>
                {row.hint ? (
                  <Typography variant="caption" component="p" sx={{ fontStyle: 'italic' }}>
                    {row.hint}
                  </Typography>
                ) : null}
              </TableCell>
              <TableCell sx={cellSx}>
                <TableSelect
                  id={fieldId(`defaultRateCategories.${row.key}`)}
                  label={`${row.label} default rate category`}
                  value={value[row.key]}
                  options={rateCategories}
                  placeholder="Choose a rate category"
                  onChange={(id) => setDefault(row.key, id)}
                />
              </TableCell>
              <TableCell sx={{ border: 0 }} />
            </TableRow>
          ))}
          {value.memberTypeOverrides.map((o) => {
            const typeKey = overrideFieldKey(o.id, 'memberTypeId');
            const categoryKey = overrideFieldKey(o.id, 'rateCategoryId');
            const type = typeLabel(o.memberTypeId);
            return (
              <TableRow key={o.id}>
                <TableCell sx={cellSx}>
                  <TableSelect
                    id={fieldId(typeKey)}
                    label={`Member type, ${type}`}
                    value={o.memberTypeId}
                    // One override per member type: taken types stay listed but cannot be picked.
                    options={memberTypes.map((m) => ({
                      ...m,
                      disabled: taken.has(m.id) && m.id !== o.memberTypeId,
                    }))}
                    placeholder="Choose a member type"
                    onChange={(id) =>
                      onChange(updateMemberTypeOverride(value, o.id, { memberTypeId: id }))
                    }
                    error={errors[typeKey]?.[0]}
                  />
                </TableCell>
                <TableCell sx={cellSx}>
                  <TableSelect
                    id={fieldId(categoryKey)}
                    label={`Default rate category, ${type}`}
                    value={o.rateCategoryId}
                    options={rateCategories}
                    placeholder="Choose a rate category"
                    onChange={(id) =>
                      onChange(updateMemberTypeOverride(value, o.id, { rateCategoryId: id }))
                    }
                    error={errors[categoryKey]?.[0]}
                  />
                </TableCell>
                <TableCell sx={{ border: 0 }}>
                  <RemoveIconButton
                    label={`override for ${type}`}
                    onClick={() => setRemoving(o.id)}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <EditOnly>
        <Button
          ref={addButton}
          startIcon={<AddCircle />}
          onClick={() => {
            const id = `override-new-${nextId.current++}`;
            onChange(addMemberTypeOverride(value, id));
            focusId.current = id;
          }}
          sx={{ mt: 1 }}
        >
          Add Member Type Override
        </Button>
      </EditOnly>
      <LegacyRemoveDialog
        open={removing !== null}
        message="Are you sure you want to delete member type override?"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) onChange(removeMemberTypeOverride(value, removing));
          setRemoving(null);
          // The removed row held the focus; the Add button is the nearest stable place.
          setTimeout(() => addButton.current?.focus(), 0);
        }}
      />
    </Box>
  );
}
