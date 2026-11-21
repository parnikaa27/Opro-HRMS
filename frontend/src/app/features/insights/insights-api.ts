import { httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Dashboard } from '../../models/insights';
import { ReportTable } from '../../shared/utils/export';

export interface ReportQuery {
  kind: string;
  year: number;
  month: string;
  by: string;
}

// The dashboard's figures and each report's rows, counted by the server. HR and super admins only; the server checks.
@Injectable({ providedIn: 'root' })
export class InsightsApi {
  dashboard = () => httpResource<Dashboard>(() => '/api/insights/dashboard');
  report = (query: () => ReportQuery) =>
    httpResource<ReportTable>(() => {
      const { kind, year, month, by } = query();
      return { url: `/api/insights/reports/${encodeURIComponent(kind)}`, params: { year, month, by } };
    });
}
