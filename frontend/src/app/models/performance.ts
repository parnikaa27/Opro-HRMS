// A round of appraisals HR opens for everyone. One is open at a time.
export interface AppraisalCycle {
  id: string;
  name: string;
  dueOn: string;
  openedOn: string;
  closedOn?: string;
}

// Weights across a person's goals add up to 100. Rated 1 to 5 at appraisal.
export interface Goal {
  id: string;
  title: string;
  measure: string;
  weight: number;
  rating?: number;
  comment?: string;
}

export type GoalPlan = Pick<Goal, 'title' | 'measure' | 'weight'>;

// The four sections of a plan besides goals. Each holds as many entries as the person adds.
export type PlanSection = 'certification' | 'learning' | 'accomplishment' | 'strength';

// A certification has a target date; a strength is a title only.
export interface PlanEntry {
  id: string;
  section: PlanSection;
  title: string;
  details?: string;
  targetOn?: string;
}

export type EntryPlan = Pick<PlanEntry, 'title' | 'details' | 'targetOn'>;

export type PlanStatus = 'draft' | 'submitted' | 'hod-approved' | 'approved' | 'rejected';

// Where someone's plan (goals and the four sections, sent together) stands: draft and rejected are theirs to change,
// submitted waits for their HOD, hod-approved for HR.
export interface CycleForm {
  status: PlanStatus;
  submittedOn?: string;
  hodApprovedByName?: string;
  hodApprovedOn?: string;
  decidedByName?: string;
  decidedOn?: string;
  note?: string;
}

// Final once the HOD saves it. The recommendations are only sent to the HOD and HR. The person has to accept it.
export interface Appraisal {
  id: string;
  cycleId: string;
  cycleName: string;
  employeeId: string;
  rating: number;
  comments: string;
  recommendsPromotion?: boolean;
  incrementPercent?: number;
  appraisedByName?: string;
  appraisedOn: string;
  acceptedOn?: string;
  selfReviewComment?: string;
  goals: Goal[];
}

export interface NewAppraisal {
  rating: number;
  comments: string;
  recommendsPromotion: boolean;
  incrementPercent?: number;
  goals: { goalId: string; rating: number; comment?: string }[];
  selfReviewComment?: string;
}

export type ProbationOutcome = 'confirmed' | 'extended' | 'not-confirmed';

export interface ProbationReview {
  id: string;
  employeeId: string;
  employeeName?: string;
  probationEnded: string;
  outcome: ProbationOutcome;
  extendedTo?: string;
  comments: string;
  reviewedByName?: string;
  reviewedOn: string;
}

export interface NewProbationReview {
  outcome: ProbationOutcome;
  extendedTo?: string;
  comments: string;
}

export interface MyPerformance {
  cycle?: AppraisalCycle;
  form?: CycleForm;
  goals: Goal[];
  entries: PlanEntry[];
  appraisals: Appraisal[];
  probationReviews: ProbationReview[];
}

export interface TeamMemberPerformance {
  employeeId: string;
  fullName: string;
  designation: string;
  // Their HOD, for a super admin looking across Opro.
  managerName?: string;
  probationEndsOn?: string;
  form?: CycleForm;
  goals: Goal[];
  entries: PlanEntry[];
  appraisal?: Appraisal;
}

export interface TeamPerformance {
  cycle?: AppraisalCycle;
  people: TeamMemberPerformance[];
}

export interface HrPerformanceRow {
  employeeId: string;
  fullName: string;
  department: string;
  managerName?: string;
  form?: CycleForm;
  goals: Goal[];
  entries: PlanEntry[];
  appraisal?: Appraisal;
}

export interface HrPerformance {
  cycles: AppraisalCycle[];
  people: HrPerformanceRow[];
  probationReviews: ProbationReview[];
}
