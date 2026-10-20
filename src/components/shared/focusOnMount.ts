// Stable ref callback that focuses its element as it mounts. Dialog actions use it so focus is
// already inside the dialog, on the right control, in the same commit that shows it. MUI's focus
// trap only moves focus to the dialog container when focus is not already inside.
export function focusOnMount(element: HTMLElement | null): void {
  element?.focus();
}
