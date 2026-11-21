// Who does an onboarding task: HR, the joiner's HOD, or the joiner.
export type TaskOwner = 'hr' | 'hod' | 'joiner';

// A task on HR's list, due this many days from joining (negative is before).
export interface OnboardingTask {
  id: string;
  name: string;
  owner: TaskOwner;
  dueInDays: number;
}

// One joiner's copy of a task, with its own due date.
export interface OnboardingItem {
  id: string;
  name: string;
  owner: TaskOwner;
  dueOn: string;
  doneOn?: string;
  doneByName?: string;
}

// A joiner's first weeks: their first day, HOD and buddy, and every task. completedOn is set once all are done.
export interface Onboarding {
  employeeId: string;
  employeeName: string;
  designation: string;
  startsOn: string;
  firstDayTime?: string;
  firstDayPlace?: string;
  firstDayContact?: string;
  hodName?: string;
  buddyId?: string;
  buddyName?: string;
  completedOn?: string;
  items: OnboardingItem[];
}
