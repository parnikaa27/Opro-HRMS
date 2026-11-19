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

// Final once the HOD saves it. The recommendations are only sent to the HOD and HR.
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
  acknowledgedOn?: string;
  goals: Goal[];
}

export interface NewAppraisal {
  rating: number;
  comments: string;
  recommendsPromotion: boolean;
  incrementPercent?: number;
  goals: { goalId: string; rating: number; comment?: string }[];
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
  goals: Goal[];
  appraisals: Appraisal[];
  probationReviews: ProbationReview[];
}

export interface TeamMemberPerformance {
  employeeId: string;
  fullName: string;
  designation: string;
  probationEndsOn?: string;
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
  goalCount: number;
  appraisal?: Appraisal;
}

export interface HrPerformance {
  cycles: AppraisalCycle[];
  people: HrPerformanceRow[];
  probationReviews: ProbationReview[];
}
