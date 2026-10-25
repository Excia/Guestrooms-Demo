import ShieldMoon from '@mui/icons-material/ShieldMoon';
import Button from '@mui/material/Button';
import { Link as RouterLink } from 'react-router';
import { NIGHT_AUDIT_HISTORY_PATH } from '../../app/routes';

/** The Night Audit link-button of the Schedule and the Reservation List: one look on both pages. */
export default function NightAuditButton() {
  return (
    <Button
      variant="contained"
      color="info"
      size="large"
      component={RouterLink}
      to={NIGHT_AUDIT_HISTORY_PATH}
      startIcon={<ShieldMoon />}
      sx={{ minWidth: (t) => t.spacing(25), whiteSpace: 'nowrap' }}
    >
      Night Audit
    </Button>
  );
}
