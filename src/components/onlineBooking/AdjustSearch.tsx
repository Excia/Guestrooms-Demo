import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import { useId, useState } from 'react';
import { criteriaSummary, type SearchCriteria } from '../../app/bookingSearch';
import { showLocations } from '../../app/locations';
import { PLACEHOLDER_LOCATIONS } from '../../app/placeholderLocations';
import { ReservationForm, type ReservationFormProps } from './ReservationWidget';

export interface AdjustSearchProps extends Omit<ReservationFormProps, 'variant' | 'initial'> {
  /** The search the results currently show. */
  criteria: SearchCriteria;
}

/** Adjust Search on the results page (Figma 12136:20582): a collapsible panel around the shared form. */
export default function AdjustSearch({ criteria, onSearch, ...form }: AdjustSearchProps) {
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState(criteria);
  const panelId = useId();
  const locations = form.locations ?? PLACEHOLDER_LOCATIONS;
  const summary = criteriaSummary(
    applied,
    (id) => locations.find((l) => l.id === id)?.name ?? id,
    showLocations(locations),
  );

  return (
    <Box
      sx={(t) => ({
        bgcolor: 'background.paper',
        border: `1px solid ${t.palette.primary.outlinedBorder}`,
        borderRadius: 0.5,
      })}
    >
      <ButtonBase
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        sx={(t) => ({
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          textAlign: 'left',
          color: 'primary.main',
          border: `1px solid ${t.palette.primary.main}`,
          borderRadius: 0.5,
          '&:hover': { bgcolor: 'primary.tint' },
          '&.Mui-focusVisible': {
            outline: `2px solid ${t.palette.primary.main}`,
            outlineOffset: 2,
          },
        })}
      >
        <ManageSearchIcon aria-hidden />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h4_fixed" component="span" sx={{ display: 'block' }}>
            Adjust Search
          </Typography>
          <Typography
            variant="caption"
            component="span"
            color="text.secondary"
            sx={{ display: 'block' }}
          >
            {summary}
          </Typography>
        </Box>
        {open ? <ExpandLessIcon aria-hidden /> : <ExpandMoreIcon aria-hidden />}
      </ButtonBase>
      <Collapse in={open} unmountOnExit={false} id={panelId}>
        <Box sx={{ p: 2 }}>
          <ReservationForm
            {...form}
            variant="update"
            initial={criteria}
            onSearch={(c) => {
              setApplied(c);
              setOpen(false);
              onSearch?.(c);
            }}
          />
        </Box>
      </Collapse>
    </Box>
  );
}
