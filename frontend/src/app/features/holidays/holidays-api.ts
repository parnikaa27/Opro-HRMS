import { httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Holiday } from '../../models/company';

@Injectable({ providedIn: 'root' })
export class HolidaysApi {
  forYear = (year: () => string) =>
    httpResource<Holiday[]>(() => ({ url: '/api/holidays', params: { year: year() } }), { defaultValue: [] });
}
