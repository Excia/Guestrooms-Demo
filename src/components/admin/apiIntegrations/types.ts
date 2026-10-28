/** Shows the page's toast. */
export type Notify = (message: string, severity: 'success' | 'warning' | 'error') => void;

/** What the page's Save button asks a panel with unsaved changes to do. */
export interface SavablePanel {
  /** Saves; resolves true when the panel has nothing left unsaved. */
  save: () => Promise<boolean>;
}
