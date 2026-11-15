import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ChangeRequest } from '../../models/company';
import { click, fail, fill, NOW, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { HrInboxPage } from './hr-inbox-page';

const URL = '/api/hr/change-requests';
const change = (overrides: Partial<ChangeRequest>): ChangeRequest => ({
  id: 'CR', employeeId: 'E', employeeName: 'Arjun Reddy', field: 'Phone number', details: '+960 777 8018', status: 'open', raisedOn: '2026-11-09', ...overrides,
});
const REQUESTS = [
  change({ id: 'CR-2', raisedOn: '2026-11-11', field: 'Emergency contact', details: 'Lakshmi, +91 98450 00000' }),
  change({ id: 'CR-1' }),
  change({ id: 'CR-0', status: 'declined', decidedOn: '2026-11-05', decisionNote: 'Need the new passport first' }),
];

describe('HrInboxPage', () => {
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

  const render = async (requests = REQUESTS) => {
    const fixture = TestBed.createComponent(HrInboxPage);
    await respond(http, { [URL]: requests });
    return fixture.nativeElement as HTMLElement;
  };

  it('shows open requests oldest first, and decided ones on their tabs', async () => {
    const root = await render();

    expect([...root.querySelectorAll('[role=tab]')].map((tab) => text(tab))).toEqual(['Open 2', 'Done', 'Declined']);
    expect(texts(root, 'change-row').map((row) => row.split(' Decline')[0])).toEqual([
      'AR Arjun Reddy Phone number · Submitted 3 days ago WHAT TO CHANGE +960 777 8018',
      'AR Arjun Reddy Emergency contact · Submitted yesterday WHAT TO CHANGE Lakshmi, +91 98450 00000',
    ]);

    click(root, 'tab-declined');
    expect(texts(root, 'change-row')).toEqual(['AR Arjun Reddy Phone number · Submitted 3 days ago YOUR NOTE Need the new passport first Declined, 5 Nov']);
    click(root, 'tab-done');
    expect(text(root)).toContain('Nothing marked done yet.');
  });

  it('marks a request done and reloads', async () => {
    const root = await render();

    click(root, 'mark-done');
    const request = http.expectOne(`${URL}/CR-1/decision`);
    expect(request.request.body).toEqual({ decision: 'done' });
    request.flush({});
    await settle();
    await respond(http, { [URL]: [] });

    expect(text(root)).toContain('Nothing to change.');
  });

  it('needs a reason to decline, and says when saving fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = await render();

    click(root, 'reject');
    click(root, 'confirm-reject');
    expect(text(root.querySelector('dialog .field-error') as HTMLElement)).toBe('Give a short reason so they know what to do next.');
    fill(root, 'decision-note', 'Send a copy of the bill');
    click(root, 'confirm-reject');
    const request = http.expectOne(`${URL}/CR-1/decision`);
    expect(request.request.body).toEqual({ decision: 'declined', note: 'Send a copy of the bill' });
    request.flush('', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(root.querySelector('[data-testid=change-row] [role=alert]')).not.toBeNull();
  });

  it('says when requests fail to load', async () => {
    const fixture = TestBed.createComponent(HrInboxPage);
    await fail(http, URL);

    expect(text(fixture.nativeElement)).toContain("Requests didn't load");
  });
});
