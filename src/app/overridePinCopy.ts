/** Words of the override PIN prompt, kept apart from the component so the rules can be tested. */

export const OVERRIDE_PIN_LABEL = 'Override code';
export const OVERRIDE_PIN_INVALID = 'That override code is not valid.';
export const OVERRIDE_PIN_UNAVAILABLE = 'The override code could not be checked. Try again.';

/** "5 minutes", "1 minute" or "45 seconds": the wait is rounded up so the text never promises too soon. */
export function waitText(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return `${s} ${s === 1 ? 'second' : 'seconds'}`;
  const minutes = Math.ceil(s / 60);
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

export const lockoutMessage = (seconds: number) =>
  `Too many incorrect codes. Try again in ${waitText(seconds)}.`;
