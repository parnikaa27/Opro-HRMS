import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormField, form, maxLength, pattern, submit } from '@angular/forms/signals';
import { FieldError } from '../../shared/ui/field-error';
import { serverReason } from '../../shared/utils/form-submit';
import { valueOr } from '../../shared/utils/resource';
import { OnboardingApi, progress } from './onboarding-api';
import { OnboardingChecklist } from './onboarding-checklist';

const MAX_TEXT = 120;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const FAILED = "That didn't save. Try again in a moment.";

// On HR's page for someone: their onboarding while it runs. HR sets the first day and ticks HR's tasks. Someone added
// before onboarding existed can be started here. Never HR's own.
@Component({
  selector: 'app-hr-onboarding-card',
  imports: [FieldError, FormField, OnboardingChecklist],
  template: `
    @if (onboarding(); as current) {
      @if (!current.completedOn) {
        <section class="card card-pad" data-testid="hr-onboarding">
          <div class="card-heading"><div><span class="eyebrow">ONBOARDING</span><h2>First weeks</h2></div><span class="card-note">{{ progress(current) }}</span></div>
          @if (!isOwn()) {
            <form class="first-day-form" novalidate (submit)="saveFirstDay($event)">
              <div class="form-row">
                <label>First day, time <input type="time" [formField]="firstDayForm.time" data-testid="first-day-time" aria-describedby="first-day-time-error" /></label>
                <label>Where <input [formField]="firstDayForm.place" placeholder="Malé office, 3rd floor reception" data-testid="first-day-place" /></label>
                <label>Ask for <input [formField]="firstDayForm.contact" placeholder="Ananya Iyer" data-testid="first-day-contact" /></label>
              </div>
              <app-field-error id="first-day-time-error" [errors]="firstDayForm.time().errors()" [isTouched]="firstDayForm.time().touched()" />
              <button type="submit" class="secondary-button" [disabled]="firstDayForm().submitting()" data-testid="save-first-day">Save first day</button>
              @if (failure()) {
                <p class="row-error" role="alert">{{ failure() }}</p>
              }
            </form>
          }
          <app-onboarding-checklist [employeeId]="employeeId()" [items]="current.items" [ticks]="isOwn() ? undefined : 'hr'" (changed)="onboardingResource.reload()" />
        </section>
      }
    } @else if (!onboardingResource.isLoading() && !onboardingResource.error() && !isOwn() && isRecent()) {
      <section class="card card-pad" data-testid="hr-onboarding">
        <div class="card-heading"><div><span class="eyebrow">ONBOARDING</span><h2>Not started</h2></div></div>
        <p class="card-text">They were added before onboarding was in the portal. Start it to give them HR's checklist.</p>
        <button type="button" class="secondary-button" [disabled]="isStarting()" (click)="start()" data-testid="start-onboarding">Start onboarding</button>
        @if (failure()) {
          <p class="row-error" role="alert">{{ failure() }}</p>
        }
      </section>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrOnboardingCard {
  private readonly api = inject(OnboardingApi);
  readonly employeeId = input.required<string>();
  // Only offer to start it for someone who joined lately, not everyone already settled in.
  readonly isRecent = input(false);
  readonly isOwn = input(false);

  protected readonly onboardingResource = this.api.of(this.employeeId);
  protected readonly onboarding = computed(() => valueOr(this.onboardingResource, null) ?? undefined);
  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly isStarting = signal(false);
  protected readonly progress = progress;
  protected readonly draft = linkedSignal(() => ({
    time: this.onboarding()?.firstDayTime ?? '',
    place: this.onboarding()?.firstDayPlace ?? '',
    contact: this.onboarding()?.firstDayContact ?? '',
  }));
  protected readonly firstDayForm = form(this.draft, (path) => {
    pattern(path.time, TIME, { message: 'Use a time like 08:45.' });
    maxLength(path.place, MAX_TEXT, { message: `Keep it under ${MAX_TEXT} characters.` });
    maxLength(path.contact, MAX_TEXT, { message: `Keep it under ${MAX_TEXT} characters.` });
  });

  protected saveFirstDay(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.firstDayForm, async () => {
      const { time, place, contact } = this.draft();
      try {
        await this.api.setFirstDay(this.employeeId(), { ...(time && { time }), ...(place.trim() && { place: place.trim() }), ...(contact.trim() && { contact: contact.trim() }) });
        this.onboardingResource.reload();
      } catch (error) {
        console.error('Saving the first day failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      }
      return undefined;
    });
  }

  protected async start() {
    this.failure.set(undefined);
    this.isStarting.set(true);
    try {
      await this.api.start(this.employeeId());
      this.onboardingResource.reload();
    } catch (error) {
      console.error('Starting onboarding failed', error);
      this.failure.set(serverReason(error) ?? FAILED);
    } finally {
      this.isStarting.set(false);
    }
  }
}
