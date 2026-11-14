import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../core/session';
import { employee, manager, NOW, respond, setupHttp, text } from '../../../testing/fixtures';
import { AttentionCard } from './attention-card';

const VISA = { workPermitNumber: 'WP', visaNumber: 'V', passportLast4: '1234', visaIssuedOn: '2025-01-01', visaExpiry: '2026-12-20', passportExpiry: '2026-11-01' };

describe('AttentionCard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  const items = (element: HTMLElement) => [...element.querySelectorAll('[data-testid=attention-item]')].map((item) => text(item as HTMLElement));

  it('warns about an expiring visa and an expired passport', async () => {
    TestBed.inject(Session).user.set(employee({ visa: VISA }));
    const fixture = TestBed.createComponent(AttentionCard);
    await respond(http, { '/api/leave/requests': [{ id: 'LR-1', status: 'pending' }] });

    expect(items(fixture.nativeElement)).toEqual([
      'Your visa expires in 38 days, on 20 December 2026. Send your renewal documents to HR. Details',
      'Your passport expired on 1 November 2026. Speak to HR today. Details',
      'One of your leave requests is still waiting for approval. See requests',
    ]);
    http.expectNone((request) => request.url.startsWith('/api/team'));
  });

  it('adds team approvals for managers', async () => {
    TestBed.inject(Session).user.set(manager());
    const fixture = TestBed.createComponent(AttentionCard);
    await respond(http, {
      '/api/leave/requests': [{ status: 'pending' }, { status: 'pending' }, { status: 'approved' }],
      '/api/team/leave-requests?status=pending': [{ id: 'LR-1' }, { id: 'LR-2' }],
      '/api/team/corrections?status=pending': [{ id: 'AC-1' }],
    });

    expect(items(fixture.nativeElement)).toEqual([
      '2 leave requests waiting for your decision. Review',
      '1 punch correction waiting for your decision. Review',
      '2 of your leave requests are still waiting for approval. See requests',
    ]);
  });

  it('says all is well when nothing needs attention', async () => {
    TestBed.inject(Session).user.set(employee());
    const fixture = TestBed.createComponent(AttentionCard);
    await respond(http, { '/api/leave/requests': [] });

    expect(text(fixture.nativeElement)).toContain("You're all caught up");
  });
});
