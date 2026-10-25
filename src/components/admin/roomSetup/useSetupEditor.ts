import { useCallback, useMemo, useState } from 'react';
import type { ConfirmDialogProps } from '../../shared/ConfirmDialog';
import { useLeaveGuard } from '../../../app/useLeaveGuard';

export interface SetupEditorOptions<T extends { id: string }, D> {
  /** The saved items in the order the list shows them. */
  items: readonly T[];
  toDraft: (item: T) => D;
  /** A new item's starting values. */
  blank: () => D;
}

// The state both setup pages share: which list item is selected (or an unsaved new one), the
// draft being edited, "unsaved changes" and the confirmation before anything discards them
// (picking another item, a new item, a link that leaves the page).
export function useSetupEditor<T extends { id: string }, D>({
  items,
  toDraft,
  blank,
}: SetupEditorOptions<T, D>) {
  // undefined: the first item; null: a new item; a string: that item.
  const [selection, setSelection] = useState<string | null | undefined>(undefined);
  const [fresh, setFresh] = useState<D | null>(null);
  const [edits, setEdits] = useState<D | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const initialBlank = useState(blank)[0];

  const selected =
    selection === null ? undefined : (items.find((i) => i.id === selection) ?? items[0]);
  const creating = selected === undefined;
  const baseline = useMemo(
    () => (selected ? toDraft(selected) : (fresh ?? initialBlank)),
    [selected, toDraft, fresh, initialBlank],
  );
  const draft = edits ?? baseline;
  const dirty = edits !== null && JSON.stringify(edits) !== JSON.stringify(baseline);
  const guard = useLeaveGuard(dirty);

  const reset = useCallback((next: string | null | undefined, base: D | null = null) => {
    setSelection(next);
    setFresh(base);
    setEdits(null);
    setAttempted(false);
  }, []);
  const guarded = (action: () => void) => (dirty ? setPending(() => action) : action());

  return {
    selectedId: selected?.id ?? null,
    selected,
    creating,
    draft,
    baseline,
    dirty,
    /** Runs `action` at once, or after the unsaved-changes prompt when the draft has edits. */
    guard: guarded,
    /** Show validation messages (after a refused save). */
    attempted,
    setAttempted,
    setDraft: setEdits as (draft: D) => void,
    select: (id: string) => guarded(() => reset(id)),
    startNew: () => guarded(() => reset(null)),
    /** A new, unsaved item with the saved values of the selected one (PDF 8.8). */
    duplicate: (copy: (saved: D) => D) => guarded(() => reset(null, copy(baseline))),
    cancelNew: () => guarded(() => reset(undefined)),
    afterSave: (id: string) => reset(id),
    afterDelete: () => reset(undefined),
    /** Props of the "has not been saved" dialog; `save` resolves true when the save succeeded. */
    confirmProps: (save: () => Promise<boolean>, title: string): ConfirmDialogProps => ({
      open: pending !== null || guard.pending,
      title,
      onClose: () => {
        setPending(null);
        guard.stay();
      },
      onDiscard: () => {
        if (pending) {
          const action = pending;
          setPending(null);
          action();
        } else guard.leave();
      },
      onConfirm: () => {
        void save().then((ok) => {
          if (!ok) {
            setPending(null);
            guard.stay();
          } else if (pending) {
            // The save re-selected the saved item; the held action (pick another) follows.
            const action = pending;
            setPending(null);
            action();
          } else guard.leave();
        });
      },
    }),
  };
}

/** Moves focus to a field by id (an input, or a wrapper that contains one). */
export function focusField(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const target = el.matches('input,textarea,button,select,[tabindex]')
    ? el
    : el.querySelector<HTMLElement>('input,textarea,button');
  target?.focus();
}
