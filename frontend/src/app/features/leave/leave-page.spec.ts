import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { click, fail, NOW, respond, setupHttp, settle, text } from '../../../testing/fixtures';
import { LeaveForm } from './leave-form';
import { LeavePage } from './leave-page';

const DATA = {
  '/api/leave/types': [{ code: 'annual', name: 'Annual leave', allowsHalfDay: true }],
  '/api/leave/balances': [{ type: 'annual', entitled: 30, taken: 9, pending: 0 }],
  '/api/leave/requests': [],
  '/api/holidays?year=2026': [],
  '/api/holidays?year=2027': [],
};

describe('LeavePage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  const render = async () => {
    const fixture = TestBed.createComponent(LeavePage);
    await respond(http, DATA);
    return fixture;
  };

  it('shows balances and requests, and opens the form', async () => {
    const root = (await render()).nativeElement as HTMLElement;

    expect(text(root)).toContain('Leave & time off');
    expect(root.querySelectorAll('[data-testid=leave-balance]')).toHaveLength(1);

    click(root, 'apply-leave');
    expect((root.querySelector('dialog') as HTMLDialogElement).open).toBe(true);
    expect(root.querySelector('app-leave-form')).not.toBeNull();
  });

  it('confirms an application, reloads, and closes on Done or Cancel', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    click(root, 'apply-leave');

    fixture.debugElement.query(By.directive(LeaveForm)).componentInstance.applied.emit(false);
    TestBed.tick();
    expect(text(root.querySelector('[data-testid=success-state]') as HTMLElement)).toContain('Request submitted Your manager has been notified. You can track the status');
    expect(http.match('/api/leave/requests')).toHaveLength(1);
    expect(http.match('/api/leave/balances')).toHaveLength(1);

    (root.querySelector('[data-testid=success-state] button') as HTMLButtonElement).click();
    await settle();
    expect((root.querySelector('dialog') as HTMLDialogElement).open).toBe(false);

    click(root, 'apply-leave');
    fixture.debugElement.query(By.directive(LeaveForm)).componentInstance.cancelled.emit();
    await settle();
    expect((root.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
  });

  it('reminds them to add a missing certificate later', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    click(root, 'apply-leave');

    fixture.debugElement.query(By.directive(LeaveForm)).componentInstance.applied.emit(true);
    TestBed.tick();

    expect(text(root.querySelector('[data-testid=success-state]') as HTMLElement)).toContain('Add your medical certificate from your request history');
  });

  it('opens the form straight away when linked with ?apply', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ apply: '1' }) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const root = (await render()).nativeElement as HTMLElement;

    expect((root.querySelector('dialog') as HTMLDialogElement).open).toBe(true);
  });

  it('explains when balances or requests fail to load', async () => {
    const fixture = TestBed.createComponent(LeavePage);
    await fail(http, '/api/leave/balances');
    await fail(http, '/api/leave/requests');

    expect(text(fixture.nativeElement)).toContain("Your balances didn't load");
    expect(text(fixture.nativeElement)).toContain("Your requests didn't load");
  });
});
