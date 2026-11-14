import { signal } from '@angular/core';

// Which request is saving and which one failed, shared by every place a manager decides.
export class DecisionState {
  readonly busyId = signal<string | undefined>(undefined);
  readonly failedId = signal<string | undefined>(undefined);

  async run(id: string, save: () => Promise<unknown>, refresh: () => void) {
    this.busyId.set(id);
    this.failedId.set(undefined);
    try {
      await save();
      refresh();
      return true;
    } catch (error) {
      console.error('Saving a decision failed', error);
      this.failedId.set(id);
      return false;
    } finally {
      this.busyId.set(undefined);
    }
  }
}
