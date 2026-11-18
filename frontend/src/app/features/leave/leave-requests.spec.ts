import { Component, signal } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LeaveRequest } from '../../models/leave';
import { click, NOW, pdf, pickFile, setupHttp, settle, text, texts } from '../../../testing/fixtures';
import { LeaveRequests } from './leave-requests';

const request = (overrides: Partial<LeaveRequest>): LeaveRequest => ({
  id: 'LR-1', employeeId: 'OPR-0018', type: 'annual', from: '2026-12-20', to: '2026-12-31', days: 8, reason: 'Home', status: 'pending', appliedOn: '2026-11-11', ...overrides,
});

@Component({
  imports: [LeaveRequests],
  template: `<app-leave-requests [requests]="requests()" [types]="types" [isReadOnly]="isReadOnly()" [certificatePath]="certificatePath()" (changed)="changes.set(changes() + 1)" />`,
})
class Host {
  readonly requests = signal<LeaveRequest[]>([]);
  readonly isReadOnly = signal(false);
  types = [
    { code: 'annual', name: 'Annual leave', allowsHalfDay: true },
    { code: 'sick', name: 'Sick leave', allowsHalfDay: true, documentRequiredAfterDays: 2 },
  ];
  readonly certificatePath = signal<string | undefined>(undefined);
  readonly changes = signal(0);
}

describe('LeaveRequests', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const render = async (requests: LeaveRequest[], isReadOnly = false, certificatePath?: string) => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.certificatePath.set(certificatePath);
    fixture.componentInstance.requests.set(requests);
    fixture.componentInstance.isReadOnly.set(isReadOnly);
    await fixture.whenStable();
    return { root: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
  };

  it('lists newest first with dates, length, status and the manager note', async () => {
    const { root } = await render([
      request({ id: 'LR-1', from: '2026-10-12', to: '2026-10-12', days: 1, status: 'rejected', decisionNote: 'Audit week', type: 'unknown' }),
      request({ id: 'LR-2', from: '2026-12-03', to: '2026-12-03', halfDay: 'second', days: 0.5, status: 'cancelled' }),
      request({ id: 'LR-3', from: '2026-12-20', to: '2026-12-20', days: 1, hodApprovedOn: '2026-11-11' }),
    ]);

    expect(texts(root, 'leave-request').map((row) => row.replace(' Cancel request', ''))).toEqual([
      'Annual leave 20 December 2026 1 day Waiting for HR',
      'Annual leave 3 December 2026 afternoon only Cancelled',
      'unknown 12 October 2026 · “Audit week” 1 day Declined',
    ]);
  });

  it('only lets people cancel pending requests or approved ones still ahead', async () => {
    const { root } = await render([
      request({ id: 'LR-1', status: 'pending' }),
      request({ id: 'LR-2', status: 'approved', from: '2026-12-01' }),
      request({ id: 'LR-3', status: 'approved', from: '2026-11-01' }),
      request({ id: 'LR-4', status: 'rejected' }),
    ]);

    expect(root.querySelectorAll('[data-testid=cancel-request]')).toHaveLength(2);
  });

  it('hides cancelling in read only mode', async () => {
    const { root } = await render([request({})], true);

    expect(root.querySelector('[data-testid=cancel-request]')).toBeNull();
  });

  it('asks before cancelling, can back out, and cancels on yes', async () => {
    const { root, host } = await render([request({})]);

    click(root, 'cancel-request');
    ([...root.querySelectorAll('button')].find((button) => text(button) === 'Keep it') as HTMLButtonElement).click();
    TestBed.tick();
    expect(root.querySelector('[data-testid=confirm-cancel]')).toBeNull();

    click(root, 'cancel-request');
    click(root, 'confirm-cancel');
    http.expectOne('/api/leave/requests/LR-1/cancel').flush({});
    await settle();

    expect(host.changes()).toBe(1);
  });

  it('says so when cancelling fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { root, host } = await render([request({})]);

    click(root, 'cancel-request');
    click(root, 'confirm-cancel');
    http.expectOne('/api/leave/requests/LR-1/cancel').flush('', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(root.querySelector('[role=alert]')).not.toBeNull();
    expect(host.changes()).toBe(0);
  });

  it('asks for a certificate only on longer sick leave that is still open', async () => {
    const { root } = await render([
      request({ id: 'LR-1', type: 'sick', days: 3 }),
      request({ id: 'LR-2', type: 'sick', days: 2 }),
      request({ id: 'LR-3', type: 'sick', days: 3, status: 'rejected' }),
      request({ id: 'LR-4', type: 'annual', days: 8 }),
    ]);

    expect(root.querySelectorAll('[data-testid=attach-certificate]')).toHaveLength(1);
  });

  it('attaches a certificate later, and turns away the wrong kind of file', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { root, host } = await render([request({ type: 'sick', days: 3 })]);

    pickFile(root, 'attach-certificate', new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(text(root.querySelector('[role=alert]') as HTMLElement)).toBe('Attach a PDF, JPG or PNG under 5 MB.');

    pickFile(root, 'attach-certificate', pdf());
    http.expectOne('/api/leave/requests/LR-1/certificate').flush('', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(text(root.querySelector('[role=alert]') as HTMLElement)).toBe("The certificate didn't upload. Try again in a moment.");

    pickFile(root, 'attach-certificate', pdf());
    http.expectOne('/api/leave/requests/LR-1/certificate').flush({});
    await settle();
    expect(host.changes()).toBe(1);
  });

  it('links to an attached certificate only for readers allowed to open it', async () => {
    const attached = request({ type: 'sick', days: 3, hasCertificate: true });

    const own = await render([attached], false, '/api/leave/requests');
    expect(own.root.querySelector('[data-testid=view-certificate]')?.getAttribute('href')).toBe('/api/leave/requests/LR-1/certificate');

    const manager = await render([attached], true);
    expect(text(manager.root.querySelector('[data-testid=certificate]') as HTMLElement)).toBe('Medical certificate attached');
  });

  it('has a helpful empty state', async () => {
    const { root } = await render([]);

    expect(text(root)).toContain('No requests yet');
  });
});
