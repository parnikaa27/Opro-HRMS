import { ChangeDetectionStrategy, Component, inject, linkedSignal, signal } from '@angular/core';
import { FormField, form, submit } from '@angular/forms/signals';
import { ApprovalRules } from '../../models/company';
import { valueOr } from '../../shared/utils/resource';
import { HrApi } from './hr-api';

const NONE: ApprovalRules = { punchFixes: false, homeDays: false, compOff: false, overtime: false };

// Which requests HR approves after the HOD. Leave is set per type in the table above.
@Component({
  selector: 'app-approval-steps-card',
  imports: [FormField],
  template: `
    <section class="card card-pad" data-testid="approval-steps-card">
      <div class="card-heading">
        <div>
          <span class="eyebrow">APPROVALS</span>
          <h2>HR after the HOD</h2>
        </div>
      </div>
      <p class="card-text">Ticked requests wait for HR once their HOD approves them. An HOD who is in HR approves both at once. Leave is set on each leave type.</p>
      @if (rules.error()) {
        <p class="attendance-off">These settings didn't load. Refresh the page to try again.</p>
      } @else {
        <form novalidate (submit)="save($event)">
          <div class="step-checks">
            <label><input type="checkbox" [formField]="rulesForm.punchFixes" data-testid="step-punch-fixes" /> Punch fixes</label>
            <label><input type="checkbox" [formField]="rulesForm.homeDays" data-testid="step-home-days" /> Home working</label>
            <label><input type="checkbox" [formField]="rulesForm.compOff" data-testid="step-comp-off" /> Comp off</label>
            <label><input type="checkbox" [formField]="rulesForm.overtime" data-testid="step-overtime" /> Overtime</label>
          </div>
          <button type="submit" class="secondary-button" [disabled]="rulesForm().submitting() || rules.isLoading()" data-testid="steps-submit">Save</button>
        </form>
        @if (status(); as message) {
          <p [attr.role]="message === saved ? 'status' : 'alert'" data-testid="steps-status">{{ message }}</p>
        }
      }
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalStepsCard {
  private readonly api = inject(HrApi);
  protected readonly rules = this.api.approvalRules();
  protected readonly saved = 'Saved. Requests the HOD approves from now on follow these.';
  protected readonly status = signal<string | undefined>(undefined);
  protected readonly draft = linkedSignal(() => valueOr(this.rules, NONE) ?? NONE);
  protected readonly rulesForm = form(this.draft);

  protected save(event: Event) {
    event.preventDefault();
    this.status.set(undefined);
    return submit(this.rulesForm, async () => {
      try {
        await this.api.saveApprovalRules(this.draft());
        this.status.set(this.saved);
        this.rules.reload();
      } catch (error) {
        console.error('Saving the approval steps failed', error);
        this.status.set("That didn't save. Try again in a moment.");
      }
      return undefined;
    });
  }
}
