import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { byTestId, click, fail, NOW, respond, setupHttp, text, texts } from '../../../testing/fixtures';
import { PEOPLE } from './hr-pages.fixtures';
import { HrVisasPage } from './hr-visas-page';

describe('HrVisasPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  it('lists expatriates with no record first, then soonest expiry, and skips nationals', async () => {
    const fixture = TestBed.createComponent(HrVisasPage);
    await respond(http, { '/api/hr/employees': PEOPLE });
    const root = fixture.nativeElement as HTMLElement;

    expect(texts(root, 'visa-row')).toEqual([
      'PN Priya Nair No record Add',
      'RV Rohit Verma MV-EV-1 02 Nov 2026 Expired 01 Jan 2030 Valid Update',
      'AR Arjun Reddy MV-EV-1 20 Dec 2026 Expires soon 01 Jan 2030 Valid Update',
    ]);
  });

  it('updates papers in a dialog and reloads the list', async () => {
    const fixture = TestBed.createComponent(HrVisasPage);
    await respond(http, { '/api/hr/employees': PEOPLE });
    const root = fixture.nativeElement as HTMLElement;

    byTestId(root, 'edit-visa')[1].click();
    TestBed.tick();
    expect(text(root.querySelector('dialog h2') as HTMLElement)).toBe('Update Rohit’s papers');
    click(root, 'visa-submit');
    await respond(http, {});
    http.expectOne('/api/hr/employees/OPR-0021/visa').flush({});
    await respond(http, { '/api/hr/employees': PEOPLE });

    expect(text(root.querySelector('dialog') as HTMLElement)).toContain('Papers updated');
    (root.querySelector('[data-testid=success-state] button') as HTMLButtonElement).click();
    TestBed.tick();
    expect(root.querySelector('dialog')?.open).toBe(false);
  });

  it('says so when the list fails and when nobody needs a visa', async () => {
    const broken = TestBed.createComponent(HrVisasPage);
    await fail(http, '/api/hr/employees');
    expect(text(broken.nativeElement)).toContain("Visa records didn't load");

    const empty = TestBed.createComponent(HrVisasPage);
    await respond(http, { '/api/hr/employees': [PEOPLE[3]] });
    expect(text(empty.nativeElement)).toContain('Nobody at Opro needs a work visa right now.');
  });
});
