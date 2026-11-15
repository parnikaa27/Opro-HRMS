import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FlightClaim, FlightYear, NewFlightClaim } from '../../models/flight';

const enc = encodeURIComponent;

// Someone's own flight allowance and claims.
@Injectable({ providedIn: 'root' })
export class FlightsApi {
  private readonly http = inject(HttpClient);

  year = () => httpResource<FlightYear>(() => '/api/flights');

  claim = (claim: NewFlightClaim) => firstValueFrom(this.http.post<FlightClaim>('/api/flights/claims', claim));
  attachReceipt = (id: string, receipt: File) => firstValueFrom(this.http.put<FlightClaim>(`/api/flights/claims/${enc(id)}/receipt`, receipt));
  cancel = (id: string) => firstValueFrom(this.http.post<FlightClaim>(`/api/flights/claims/${enc(id)}/cancel`, {}));
}
