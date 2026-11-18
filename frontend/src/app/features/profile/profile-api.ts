import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BankAccount, EmployeeRecord, NewBankAccount } from '../../models/record';

export interface ChangeRequest {
  field: string;
  details: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileApi {
  private readonly http = inject(HttpClient);

  requestChange = (request: ChangeRequest) => firstValueFrom(this.http.post<void>('/api/profile/change-requests', request));
  record = () => httpResource<EmployeeRecord>(() => '/api/profile/record');
  // New details wait for HR to verify them.
  saveBank = (bank: NewBankAccount) => firstValueFrom(this.http.put<BankAccount>('/api/profile/bank-account', bank));
}
