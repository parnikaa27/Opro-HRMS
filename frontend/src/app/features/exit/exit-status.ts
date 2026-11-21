import { ChecklistItem, Resignation } from '../../models/exit';
import { Tone } from '../../shared/ui/status-pill';

// Where one item on someone's way out stands. who is "them" for HR, "you" for the person.
export const itemStatus = ({ outcome }: ChecklistItem, who: 'them' | 'you'): { label: string; tone: Tone } =>
  outcome === 'returned'
    ? { label: 'Returned', tone: 'ok' }
    : outcome === 'not-given'
      ? { label: 'Never given', tone: 'neutral' }
      : { label: `Still with ${who}`, tone: 'late' };

export const stillOut = (resignation: Resignation | undefined) => (resignation?.checklist ?? []).filter(({ outcome }) => !outcome).map(({ name }) => name);
