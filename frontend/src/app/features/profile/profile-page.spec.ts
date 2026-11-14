import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Session } from '../../core/session';
import { click, employee, NOW, setupHttp, settle, text } from '../../../testing/fixtures';
import { ChangeRequestForm } from './change-request-form';
import { ProfilePage } from './profile-page';

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    setupHttp();
    TestBed.inject(Session).user.set(employee({ nationality: 'Maldivian' }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const render = async () => {
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    return fixture;
  };

  it('shows the printable card, the staff card and the visa section', async () => {
    const root = (await render()).nativeElement as HTMLElement;

    expect(text(root.querySelector('[data-testid=id-card-number]') as HTMLElement)).toBe('OPR-0018');
    expect(root.querySelector('[data-testid=employee-card]')).not.toBeNull();
    expect(root.querySelector('[data-testid=visa-none]')).not.toBeNull();
  });

  it('prints the card with the browser print dialog', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const root = (await render()).nativeElement as HTMLElement;

    click(root, 'print-card');

    expect(print).toHaveBeenCalled();
  });

  it('confirms a change request, and closes on Done or Cancel', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    click(root, 'request-change');
    fixture.debugElement.query(By.directive(ChangeRequestForm)).componentInstance.sent.emit();
    TestBed.tick();
    expect(text(root.querySelector('[data-testid=success-state]') as HTMLElement)).toContain('Sent to HR');
    (root.querySelector('[data-testid=success-state] button') as HTMLButtonElement).click();
    await settle();
    expect((root.querySelector('dialog') as HTMLDialogElement).open).toBe(false);

    click(root, 'request-change');
    fixture.debugElement.query(By.directive(ChangeRequestForm)).componentInstance.cancelled.emit();
    await settle();
    expect((root.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
  });
});
