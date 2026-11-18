import { httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AttendanceDay } from '../../models/attendance';
import { Insights } from '../../models/insights';

// The facts behind the dashboard and reports. HR and super admins only; the server checks.
@Injectable({ providedIn: 'root' })
export class InsightsApi {
  insights = () => httpResource<Insights>(() => '/api/insights');
  // Waits until there's a month to ask for.
  attendance = (month: () => string | undefined) =>
    httpResource<AttendanceDay[]>(() => {
      const chosen = month();
      return chosen ? { url: '/api/insights/attendance', params: { month: chosen } } : undefined;
    }, { defaultValue: [] });
}
