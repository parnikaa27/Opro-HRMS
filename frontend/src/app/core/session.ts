import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Employee } from '../models/employee';
import { readPreference, savePreference } from '../shared/utils/preference';

export type PortalView = 'mine' | 'team';

const VIEW_KEY = 'opro.view';
const VIEWS: readonly PortalView[] = ['mine', 'team'];

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly user = signal<Employee | undefined>(undefined);
  readonly isManager = computed(() => this.user()?.roles.includes('MANAGER') ?? false);

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
    const startsInTeam = this.isManager() && readPreference(VIEW_KEY, VIEWS, 'mine') === 'team';
    await this.router.navigateByUrl(startsInTeam ? '/team' : '/');
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
    await this.router.navigateByUrl(view === 'team' ? '/team' : '/');
  }

  clear() {
    this.user.set(undefined);
    void this.router.navigateByUrl('/login');
  }
}
