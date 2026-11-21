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

// What the person writes about their year. The HOD comments on it when appraising.
export interface SelfReview {
  accomplishments?: string;
  strengths?: string;
  learning?: string;
  certifications?: string;
}

// Where someone's goals stand: draft and rejected are theirs to change, submitted waits for their HOD, hod-approved
// for HR. Plus their self review.
export interface CycleForm extends SelfReview {
  goalsStatus: 'draft' | 'submitted' | 'hod-approved' | 'approved' | 'rejected';
  goalsSubmittedOn?: string;
  hodApprovedByName?: string;
  hodApprovedOn?: string;
  goalsDecidedByName?: string;
  goalsDecidedOn?: string;
  goalsNote?: string;
  selfReviewedOn?: string;
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
  appraisals: Appraisal[];
  probationReviews: ProbationReview[];
}

export interface TeamMemberPerformance {
  employeeId: string;
  fullName: string;
  designation: string;
  probationEndsOn?: string;
  form?: CycleForm;
  goals: Goal[];
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
  appraisal?: Appraisal;
}

export interface HrPerformance {
  cycles: AppraisalCycle[];
  people: HrPerformanceRow[];
  probationReviews: ProbationReview[];
}
