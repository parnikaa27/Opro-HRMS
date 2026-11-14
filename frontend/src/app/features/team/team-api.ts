import { httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CorrectionRequest } from '../../models/attendance';
import { LeaveRequest } from '../../models/leave';

type Status = 'pending' | 'approved' | 'rejected';

// Pass isEnabled so non managers never fire these requests.
@Injectable({ providedIn: 'root' })
export class TeamApi {
  leaveRequests = (status: Status, isEnabled: () => boolean) =>
    httpResource<LeaveRequest[]>(() => (isEnabled() ? { url: '/api/team/leave-requests', params: { status } } : undefined), { defaultValue: [] });

  corrections = (status: Status, isEnabled: () => boolean) =>
    httpResource<CorrectionRequest[]>(() => (isEnabled() ? { url: '/api/team/corrections', params: { status } } : undefined), { defaultValue: [] });
}
