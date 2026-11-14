import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Session } from '../../core/session';
import { EmployeeSummary } from '../../models/employee';
import { Avatar } from '../../shared/ui/avatar';
import { StatusPill } from '../../shared/ui/status-pill';
import { valueOr } from '../../shared/utils/resource';

const isManager = (person: EmployeeSummary) => person.roles.includes('MANAGER');

// Development only. Real sign in arrives with the Spring backend.
@Component({
  selector: 'app-login-page',
  imports: [Avatar, StatusPill],
  template: `
    <main class="mx-auto grid min-h-dvh max-w-5xl content-center gap-12 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-20">
      <div class="self-center">
        <p class="font-display text-5xl font-medium tracking-tight sm:text-6xl">opro</p>
        <h1 class="mt-6 max-w-md font-display text-3xl leading-tight sm:text-4xl">Your punches, your leave, your team. All in one place.</h1>
        <p class="mt-4 max-w-sm text-soft">
          This is a test sign in. Pick anyone below to see the portal the way they would. The real one will use your work account.
        </p>
      </div>

      <section class="rounded-2xl border border-line bg-card p-2 shadow-lift" aria-labelledby="pick-heading">
        <h2 id="pick-heading" class="eyebrow px-3 pt-3 pb-2">Sign in as</h2>
        @if (people.isLoading()) {
          <p class="px-3 pb-3 text-sm text-soft">Finding everyone…</p>
        } @else if (people.error()) {
          <p class="px-3 pb-3 text-sm text-danger" data-testid="login-load-error">Can't reach the server. Is the mock API running?</p>
        } @else {
          <ul>
            @for (person of sortedPeople(); track person.id) {
              <li>
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-canvas disabled:opacity-60"
                  [disabled]="signingInAs() !== undefined"
                  [attr.data-testid]="'login-as-' + person.id"
                  (click)="signIn(person.id)"
                >
                  <app-avatar [name]="person.fullName" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-medium">{{ person.fullName }}</span>
                    <span class="block truncate text-sm text-soft">{{ person.designation }}</span>
                  </span>
                  @if (signingInAs() === person.id) {
                    <span class="text-sm text-soft">Signing in…</span>
                  } @else if (roleLabel(person); as label) {
                    <app-status-pill tone="sea">{{ label }}</app-status-pill>
                  }
                </button>
              </li>
            }
          </ul>
        }
        @if (signInFailed()) {
          <p class="px-3 pb-3 text-sm text-danger" role="alert">That didn't work. Try again in a moment.</p>
        }
      </section>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly session = inject(Session);

  protected readonly people = httpResource<EmployeeSummary[]>(() => '/api/session/users', { defaultValue: [] });
  protected readonly sortedPeople = computed(() =>
    [...valueOr(this.people, [])].sort((first, second) => Number(this.roleLabel(second) !== undefined) - Number(this.roleLabel(first) !== undefined)),
  );
  protected readonly signingInAs = signal<string | undefined>(undefined);
  protected readonly signInFailed = signal(false);
  protected readonly roleLabel = (person: EmployeeSummary) => (person.roles.includes('HR') ? 'HR' : isManager(person) ? 'Manager' : undefined);

  protected async signIn(employeeId: string) {
    this.signingInAs.set(employeeId);
    this.signInFailed.set(false);
    try {
      await this.session.signIn(employeeId);
    } catch (error) {
      console.error('Sign in failed', error);
      this.signInFailed.set(true);
    } finally {
      this.signingInAs.set(undefined);
    }
  }
}
