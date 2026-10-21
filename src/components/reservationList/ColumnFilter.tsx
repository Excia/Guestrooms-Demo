import FilterList from '@mui/icons-material/FilterList';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import { useId, useState } from 'react';

interface BaseProps {
  /** The column's name: "Guest". */
  label: string;
}

export interface TextColumnFilterProps extends BaseProps {
  kind: 'text';
  value: string;
  onChange: (value: string) => void;
}

export interface ListColumnFilterProps extends BaseProps {
  kind: 'list';
  options: readonly { value: string; label: string }[];
  value: readonly string[];
  onChange: (value: string[]) => void;
}

export type ColumnFilterProps = TextColumnFilterProps | ListColumnFilterProps;

/**
 * The filter icon of a column header (Figma Reservation List) and its popover. A text filter is
 * applied with Enter or Apply (each change is a server request); a value-list filter applies as
 * boxes are ticked. The icon carries a dot while the filter narrows the list.
 */
export default function ColumnFilter(props: ColumnFilterProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  const active = props.kind === 'text' ? props.value.trim() !== '' : props.value.length > 0;
  return (
    <>
      <IconButton
        size="small"
        aria-label={active ? `Filter ${props.label}, active` : `Filter ${props.label}`}
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        aria-controls={anchor ? id : undefined}
        color={active ? 'primary' : 'default'}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <Badge color="primary" variant="dot" invisible={!active}>
          <FilterList fontSize="small" />
        </Badge>
      </IconButton>
      <Popover
        id={id}
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: { role: 'dialog', 'aria-label': `Filter ${props.label}`, sx: { p: 2 } },
        }}
      >
        {props.kind === 'text' ? (
          <TextFilterForm {...props} onDone={() => setAnchor(null)} />
        ) : (
          <FormGroup aria-label={`${props.label} values`}>
            {props.options.map((o) => (
              <FormControlLabel
                key={o.value}
                label={o.label}
                control={
                  <Checkbox
                    checked={props.value.includes(o.value)}
                    onChange={(_, checked) =>
                      props.onChange(
                        checked
                          ? [...props.value, o.value]
                          : props.value.filter((v) => v !== o.value),
                      )
                    }
                  />
                }
              />
            ))}
            {props.options.length === 0 ? (
              <Box component="span" sx={{ color: 'text.secondary' }}>
                No values to choose from.
              </Box>
            ) : null}
            <Button
              size="small"
              sx={{ alignSelf: 'flex-start', mt: 1 }}
              disabled={props.value.length === 0}
              onClick={() => props.onChange([])}
            >
              Clear
            </Button>
          </FormGroup>
        )}
      </Popover>
    </>
  );
}

function TextFilterForm({
  label,
  value,
  onChange,
  onDone,
}: TextColumnFilterProps & { onDone: () => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        onChange(draft.trim());
        onDone();
      }}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: (t) => t.spacing(30) }}
    >
      <TextField
        autoFocus
        size="small"
        label={`Filter ${label}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        slotProps={{ htmlInput: { maxLength: 200 } }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          size="small"
          onClick={() => {
            setDraft('');
            onChange('');
            onDone();
          }}
          disabled={draft === '' && value === ''}
        >
          Clear
        </Button>
        <Button size="small" type="submit" variant="contained">
          Apply
        </Button>
      </Box>
    </Box>
  );
}
