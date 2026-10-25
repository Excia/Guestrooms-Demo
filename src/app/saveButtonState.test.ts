import { describe, expect, it } from 'vitest';
import { saveButtonState } from './saveButtonState';

describe('saveButtonState', () => {
  it('reads Saved when there is nothing to save, even when blocked', () => {
    expect(saveButtonState({ dirty: false, saving: false, disabled: false })).toBe('saved');
    expect(saveButtonState({ dirty: false, saving: false, disabled: true })).toBe('saved');
  });
  it('offers Save when there are changes', () => {
    expect(saveButtonState({ dirty: true, saving: false, disabled: false })).toBe('save');
  });
  it('blocks Save when changes may not be saved', () => {
    expect(saveButtonState({ dirty: true, saving: false, disabled: true })).toBe('blocked');
  });
  it('shows saving while a request is in flight', () => {
    expect(saveButtonState({ dirty: true, saving: true, disabled: false })).toBe('saving');
  });
});
