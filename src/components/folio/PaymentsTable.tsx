import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { FolioPayment } from '../../api';
import { formatMoney } from '../../app/quickStats';
import { formatDisplayDate } from '../../app/folioFormat';
import { tableBorder } from './tableStyles';

const COLUMNS = ['Type', 'Date', 'Reference #', 'Ticket', 'Description', 'Amount', 'Status'];

// Payments table (Figma 12047:8192). Read-only here: remove/refund and selecting a payment to
// settle arrive with their tickets.
export default function PaymentsTable({
  payments,
  labelledBy,
}: {
  payments: readonly FolioPayment[];
  labelledBy: string;
}) {
  return (
    <TableContainer sx={tableBorder}>
      <Table size="small" aria-labelledby={labelledBy}>
        <TableHead>
          <TableRow>
            {COLUMNS.map((c) => (
              <TableCell key={c} component="th" scope="col" sx={{ fontWeight: 'fontWeightBold' }}>
                {c}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMNS.length}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No payments yet.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.typeLabel}</TableCell>
                <TableCell>{formatDisplayDate(p.date)}</TableCell>
                <TableCell>{p.reference}</TableCell>
                <TableCell>{p.ticket ?? 'N/A'}</TableCell>
                <TableCell>{p.description}</TableCell>
                <TableCell>{formatMoney(p.amountCents)}</TableCell>
                <TableCell>{p.status}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
