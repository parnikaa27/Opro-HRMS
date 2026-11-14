import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { click, fail, NOW, respond, setupHttp, text } from '../../../testing/fixtures';
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

  it('shows balances and requests, and opens the form', async () => {
    const fixture = TestBed.createComponent(LeavePage);
    await respond(http, DATA);
    const root = fixture.nativeElement as HTMLElement;

    expect(text(root)).toContain('What you have left for 2026');
    expect(root.querySelectorAll('[data-testid=leave-balance]')).toHaveLength(1);

    click(root, 'apply-leave');
    expect((root.querySelector('dialog') as HTMLDialogElement).open).toBe(true);
    expect(root.querySelector('app-leave-form')).not.toBeNull();
  });

  it('closes the form and reloads after an application', async () => {
    const fixture = TestBed.createComponent(LeavePage);
    await respond(http, DATA);
    const root = fixture.nativeElement as HTMLElement;
    click(root, 'apply-leave');

    fixture.debugElement.query(By.directive(LeaveForm)).componentInstance.applied.emit();
    TestBed.tick();

    expect((root.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
    expect(http.match('/api/leave/requests')).toHaveLength(1);
    expect(http.match('/api/leave/balances')).toHaveLength(1);
  });

  it('explains when balances or requests fail to load', async () => {
    const fixture = TestBed.createComponent(LeavePage);
    await fail(http, '/api/leave/balances');
    await fail(http, '/api/leave/requests');

    expect(text(fixture.nativeElement)).toContain("Your balances didn't load");
    expect(text(fixture.nativeElement)).toContain("Your requests didn't load");
  });
});
