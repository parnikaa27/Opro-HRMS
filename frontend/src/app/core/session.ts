import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Employee } from '../models/employee';
import { readPreference, savePreference } from '../shared/utils/preference';

export type PortalView = 'mine' | 'team' | 'hr';

const VIEW_KEY = 'opro.view';
const VIEWS: readonly PortalView[] = ['mine', 'team', 'hr'];
const VIEW_HOME: Record<PortalView, string> = { mine: '/', team: '/team', hr: '/hr' };

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly user = signal<Employee | undefined>(undefined);
  readonly isManager = computed(() => this.user()?.roles.includes('MANAGER') ?? false);
  readonly isHr = computed(() => this.user()?.roles.includes('HR') ?? false);

  async restore() {
    if (this.user()) {
      return this.user();
    }
    try {
      this.user.set(await firstValueFrom(this.http.get<Employee>('/api/me')));
    } catch (error) {
      if (!(error instanceof HttpErrorResponse && error.status === HttpStatusCode.Unauthorized)) {
        console.error('Could not load the signed in user', error);
      }
    }
    return this.user();
  }

  async signIn(employeeId: string) {
    await firstValueFrom(this.http.post<void>('/api/session/login', { employeeId }));
    await this.restore();
    const saved = readPreference(VIEW_KEY, VIEWS, 'mine');
    const isAllowed = (saved === 'team' && this.isManager()) || (saved === 'hr' && this.isHr());
    await this.router.navigateByUrl(isAllowed ? VIEW_HOME[saved] : '/');
  }

  async signOut() {
    try {
      await firstValueFrom(this.http.post<void>('/api/session/logout', {}));
    } finally {
      this.clear();
    }
  }

  async switchView(view: PortalView) {
    savePreference(VIEW_KEY, view);
    await this.router.navigateByUrl(VIEW_HOME[view]);
  }

  clear() {
    this.user.set(undefined);
    void this.router.navigateByUrl('/login');
  }
}
