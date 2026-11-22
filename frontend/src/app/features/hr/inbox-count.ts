import { computed, inject } from '@angular/core';
import { valueOr } from '../../shared/utils/resource';
import { AllowanceApi } from '../allowance/allowance-api';
import { ExitApi } from '../exit/exit-api';
import { HrApi, NOTHING_WAITING } from './hr-api';

// Everything waiting in HR's inbox, counted one way for the sidebar badge and HR's overview: open detail changes,
// documents and bank details to check, requests HR approves after the HOD, resignations and one-off allowances.
// Call it where inject works, like a field initialiser.
export const inboxCount = (isEnabled: () => boolean = () => true) => {
  const hr = inject(HrApi);
  const changes = hr.changeRequests({ isEnabled });
  const documents = hr.waitingDocuments({ isEnabled });
  const banks = hr.waitingBanks({ isEnabled });
  const approvals = hr.approvals({ isEnabled });
  const resignations = inject(ExitApi).waitingForHr({ isEnabled });
  const grants = inject(AllowanceApi).waitingForHr({ isEnabled });
  return {
    count: computed(
      () =>
        valueOr(changes, []).filter(({ status }) => status === 'open').length +
        valueOr(documents, []).length +
        valueOr(banks, []).length +
        valueOr(resignations, []).length +
        valueOr(grants, []).length +
        Object.values(valueOr(approvals, NOTHING_WAITING)).reduce((total, list) => total + list.length, 0),
    ),
    reload: () => [changes, documents, banks, approvals, resignations, grants].forEach((resource) => resource.reload()),
  };
};
