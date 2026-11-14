import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Session } from '../../core/session';
import { Card } from '../../shared/ui/card';
import { Icon } from '../../shared/ui/icon';
import { daysUntil, formatFullDate, maldivesToday } from '../../shared/utils/date-time';
import { expiryStatus } from '../../shared/utils/expiry';
import { plural } from '../../shared/utils/text';
import { LeaveApi } from '../leave/leave-api';
import { TeamApi } from '../team/team-api';
import { valueOr } from '../../shared/utils/resource';

type Urgency = 'danger' | 'late' | 'sea';

interface AttentionItem {
  text: string;
  urgency: Urgency;
  link: string;
  linkText: string;
}

const DOT: Record<Urgency, string> = { danger: 'bg-danger', late: 'bg-late', sea: 'bg-sea' };

const expiryItem = (document: string, expiry: string, today: string): AttentionItem[] => {
  const status = expiryStatus(expiry, today);
  if (status === 'valid') {
    return [];
  }
  const text =
    status === 'expired'
      ? `Your ${document} expired on ${formatFullDate(expiry)}. Speak to HR today.`
      : `Your ${document} expires in ${plural(daysUntil(expiry, today), 'day')}, on ${formatFullDate(expiry)}. Send your renewal documents to HR.`;
  return [{ text, urgency: status === 'expired' ? 'danger' : 'late', link: '/profile', linkText: 'Details' }];
};

@Component({
  selector: 'app-attention-card',
  imports: [Card, RouterLink, Icon],
  template: `
    <app-card label="Needs your attention" [isLoading]="isLoading()">
      <ul class="mt-3 space-y-3">
        @for (item of items(); track item.text) {
          <li class="flex gap-3 text-sm" data-testid="attention-item">
            <span class="mt-1.5 size-2 shrink-0 rounded-full" [class]="dot[item.urgency]" aria-hidden="true"></span>
            <span class="flex-1">
              {{ item.text }}
              <a [routerLink]="item.link" class="ms-1 inline-flex items-center gap-0.5 font-medium text-sea hover:underline">
                {{ item.linkText }} <app-icon name="arrow" class="size-3.5" />
              </a>
            </span>
          </li>
        } @empty {
          <li class="text-sm text-soft">You're all caught up. Nothing needs you right now.</li>
        }
      </ul>
    </app-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttentionCard {
  private readonly session = inject(Session);
  private readonly today = maldivesToday();
  private readonly myRequests = inject(LeaveApi).requests();
  private readonly teamLeave = inject(TeamApi).leaveRequests({ status: 'pending', isEnabled: this.session.isManager });
  private readonly teamCorrections = inject(TeamApi).corrections({ status: 'pending', isEnabled: this.session.isManager });

  protected readonly dot = DOT;
  protected readonly isLoading = computed(() => this.myRequests.isLoading() || this.teamLeave.isLoading() || this.teamCorrections.isLoading());

  protected readonly items = computed<AttentionItem[]>(() => {
    const visa = this.session.user()?.visa;
    const myPending = valueOr(this.myRequests, []).filter((request) => request.status === 'pending').length;
    const teamLeave = valueOr(this.teamLeave, []).length;
    const teamCorrections = valueOr(this.teamCorrections, []).length;

    return [
      ...(visa ? expiryItem('visa', visa.visaExpiry, this.today) : []),
      ...(visa ? expiryItem('passport', visa.passportExpiry, this.today) : []),
      ...(teamLeave ? [{ text: `${plural(teamLeave, 'leave request')} waiting for your decision.`, urgency: 'sea' as const, link: '/team/approvals', linkText: 'Review' }] : []),
      ...(teamCorrections ? [{ text: `${plural(teamCorrections, 'punch correction')} waiting for your decision.`, urgency: 'sea' as const, link: '/team/approvals', linkText: 'Review' }] : []),
      ...(myPending ? [{ text: myPending === 1 ? 'One of your leave requests is still waiting for approval.' : `${myPending} of your leave requests are still waiting for approval.`, urgency: 'sea' as const, link: '/leave', linkText: 'See requests' }] : []),
    ];
  });
}
