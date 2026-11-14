import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Session } from '../../core/session';
import { click, employee, NOW, setupHttp, text } from '../../../testing/fixtures';
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

  it('shows the ID card and the visa section for the signed in person', async () => {
    const root = (await render()).nativeElement as HTMLElement;

    expect(text(root.querySelector('[data-testid=id-card-number]') as HTMLElement)).toBe('OPR-0018');
    expect(root.querySelector('[data-testid=visa-none]')).not.toBeNull();
  });

  it('prints the card with the browser print dialog', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const root = (await render()).nativeElement as HTMLElement;

    click(root, 'print-card');

    expect(print).toHaveBeenCalled();
  });

  it('confirms once a change request is sent', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    click(root, 'request-change');
    expect((root.querySelector('dialog') as HTMLDialogElement).open).toBe(true);

    fixture.debugElement.query(By.directive(ChangeRequestForm)).componentInstance.sent.emit();
    TestBed.tick();

    expect((root.querySelector('dialog') as HTMLDialogElement).open).toBe(false);
    expect(root.querySelector('[data-testid=change-sent]')).not.toBeNull();
  });
});
