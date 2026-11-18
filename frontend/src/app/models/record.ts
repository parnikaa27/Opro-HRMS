// The rest of someone's record. Field names match Spring's RecordResponses.

export interface MedicalInsurance {
  provider: string;
  policyNumber: string;
  expiresOn: string;
}

// accountNumber comes to HR only. Everyone else gets the last 4.
export interface BankAccount {
  employeeId?: string;
  employeeName?: string;
  bankName: string;
  accountName: string;
  accountNumber?: string;
  accountLast4: string;
  currency: 'MVR' | 'USD';
  status: 'pending' | 'verified' | 'rejected';
  submittedOn: string;
  decisionNote?: string;
}

export interface Education {
  id: string;
  qualification: string;
  institution: string;
  completedYear: number;
}

// to is missing for a job still running when they joined.
export interface Experience {
  id: string;
  employer: string;
  role: string;
  from: string;
  to?: string;
}

export interface EmployeeRecord {
  insurance?: MedicalInsurance;
  bankAccount?: BankAccount;
  education: Education[];
  experience: Experience[];
}

export type NewBankAccount = Pick<BankAccount, 'bankName' | 'accountName' | 'currency'> & { accountNumber: string };

// One expatriate quota approval. used is counted from active expatriates in that job category.
export interface Quota {
  id: string;
  jobCategory: string;
  slots: number;
  used: number;
  approvalNumber: string;
  approvedOn: string;
  expiresOn: string;
}
