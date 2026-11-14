import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fill, NOW, setupHttp, settle, text } from '../../../testing/fixtures';
import { CorrectionForm } from './correction-form';

describe('CorrectionForm', () => {
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

  const render = async () => {
    const fixture = TestBed.createComponent(CorrectionForm);
    fixture.componentRef.setInput('date', '2026-11-10');
    fixture.componentRef.setInput('kind', 'missed-in');
    let raised = 0;
    let cancelled = 0;
    fixture.componentInstance.raised.subscribe(() => raised++);
    fixture.componentInstance.cancelled.subscribe(() => cancelled++);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const submitForm = async () => {
      (root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { cancelable: true }));
      await settle();
    };
    return { root, submitForm, raisedCount: () => raised, cancelledCount: () => cancelled };
  };

  it('starts from the day and kind it was opened with', async () => {
    const { root } = await render();

    expect((root.querySelector('[data-testid=fix-date]') as HTMLInputElement).value).toBe('2026-11-10');
    expect((root.querySelector('[data-testid=fix-kind]') as HTMLSelectElement).value).toBe('missed-in');
  });

  it('asks for the time and a reason, and refuses future days', async () => {
    const { root, submitForm } = await render();
    fill(root, 'fix-date', '2026-11-20');
    await submitForm();

    expect([...root.querySelectorAll('.field-error')].map((error) => text(error))).toEqual([
      "You can't fix a day that hasn't happened yet.",
      'When did you actually punch?',
      'Tell your manager what happened.',
    ]);
    http.expectNone('/api/attendance/corrections');
  });

  it('sends the fix and tells the page', async () => {
    const { root, submitForm, raisedCount } = await render();
    fill(root, 'fix-time', '08:55');
    fill(root, 'fix-reason', ' Started at the port ');
    await submitForm();

    const request = http.expectOne('/api/attendance/corrections');
    expect(request.request.body).toEqual({ date: '2026-11-10', kind: 'missed-in', requestedTime: '08:55', reason: 'Started at the port' });
    request.flush({});
    await settle();
    expect(raisedCount()).toBe(1);
  });

  it('says so when sending fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { root, submitForm, raisedCount } = await render();
    fill(root, 'fix-time', '08:55');
    fill(root, 'fix-reason', 'Device down');
    await submitForm();

    http.expectOne('/api/attendance/corrections').flush('', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(root.querySelector('[role=alert]')).not.toBeNull();
    expect(raisedCount()).toBe(0);
  });

  it('lets people back out', async () => {
    const { root, cancelledCount } = await render();

    (root.querySelector('.secondary-button') as HTMLButtonElement).click();

    expect(cancelledCount()).toBe(1);
  });
});
