import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { BALANCE_TONE_LABELS, type BalanceTone } from '../../app/folio';
import { formatMoney } from '../../app/quickStats';
import type { Cents } from '../../api';
import { visuallyHidden } from '@mui/utils';

const TONE_COLOR = {
  grey: 'balanceGrey',
  yellow: 'balanceYellow',
  green: 'balanceGreen',
  red: 'balanceRed',
} as const;

export interface BalanceSummaryProps {
  tone: BalanceTone;
  postedCents: Cents;
  unpostedCents: Cents;
}

// Balance Summary (Figma 16575:25666): posted and unposted balance side by side on a tinted card.
export default function BalanceSummary({ tone, postedCents, unpostedCents }: BalanceSummaryProps) {
  return (
    <Box
      role="group"
      aria-label="Balance summary"
      data-tone={tone}
      sx={{
        display: 'flex',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        bgcolor: (t) => t.palette.folio[TONE_COLOR[tone]],
        color: 'common.black',
      }}
    >
      <Box component="span" sx={visuallyHidden}>
        {BALANCE_TONE_LABELS[tone]}
      </Box>
      <Figure label="Posted Balance" cents={postedCents} />
      <Divider orientation="vertical" flexItem />
      <Figure label="Unposted Balance" cents={unpostedCents} />
    </Box>
  );
}

function Figure({ label, cents }: { label: string; cents: Cents }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="h4_fixed" component="span" sx={{ fontSize: '0.875rem' }}>
        {label}
      </Typography>
      <Typography component="span" sx={{ fontSize: '1.5rem', lineHeight: 1.4 }}>
        {formatMoney(cents)}
      </Typography>
    </Box>
  );
}
