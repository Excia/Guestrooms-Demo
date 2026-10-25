import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** Opens the three-dot menu of the selected list row and clicks one of its items. */
export async function clickMoreMenuItem(user: UserEvent, itemName: string) {
  await user.click(screen.getByRole('button', { name: /more options$/ }));
  await user.click(await screen.findByRole('menuitem', { name: itemName }));
}
