import { httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Colleague } from '../models/employee';

// Everyone working at Opro today, for search.
@Injectable({ providedIn: 'root' })
export class ColleaguesApi {
  colleagues = (isEnabled: () => boolean) => httpResource<Colleague[]>(() => (isEnabled() ? '/api/people' : undefined), { defaultValue: [] });
}
