// The "Add guest" dialog of the New Reservation panel: form checks.
import { isEmail, MAX_NAME_LENGTH } from '../api/validation';

export interface GuestForm {
  name: string;
  email: string;
  phone: string;
}

export type GuestErrors = Partial<Record<keyof GuestForm, string>>;

export const emptyGuestForm: GuestForm = { name: '', email: '', phone: '' };

/** Name is required; email and phone are optional but must look right when given. */
export function validateGuest(form: GuestForm): GuestErrors {
  const errors: GuestErrors = {};
  const name = form.name.trim();
  if (name === '') errors.name = 'Enter the guest’s name.';
  else if (name.length > MAX_NAME_LENGTH) errors.name = 'That name is too long.';
  const email = form.email.trim();
  if (email !== '' && !isEmail(email)) errors.email = 'Enter a valid email address.';
  const phone = form.phone.trim();
  if (phone.length > 40) errors.phone = 'That phone number is too long.';
  else if (phone !== '' && !/^[0-9+()\-.\s]+$/.test(phone)) {
    errors.phone = 'Use digits, spaces and + ( ) - only.';
  }
  return errors;
}
