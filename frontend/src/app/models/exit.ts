// Someone resigning: their HOD approves, then HR, who sets the exit date. The checklist is empty until it's approved;
// each item is returned, not-given, or still out (no outcome).
export interface Resignation {
  id: string;
  employeeId: string;
  employeeName?: string;
  submittedOn: string;
  reason: string;
  releaseOn: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  hodApprovedByName?: string;
  hodApprovedOn?: string;
  decidedByName?: string;
  decidedOn?: string;
  decisionNote?: string;
  exitOn?: string;
  checklist: ChecklistItem[];
}

export interface ChecklistItem {
  itemId: string;
  name: string;
  outcome?: 'returned' | 'not-given';
  tickedOn?: string;
}

// Something HR collects back before someone leaves.
export interface ExitItem {
  id: string;
  name: string;
}
