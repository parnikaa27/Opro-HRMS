import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { click, fail, fill, NOW, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { RecordCard } from './record-card';

const RECORD = {
  bankAccount: { bankName: 'Bank of Maldives', accountName: 'Arjun Reddy', accountLast4: '3456', currency: 'MVR', status: 'rejected', submittedOn: '2026-11-01', decisionNote: 'Name is cut off' },
  education: [{ id: 'ED-1', qualification: 'BTech', institution: 'Osmania University', completedYear: 2016 }],
  experience: [{ id: 'EX-1', employer: 'L&T Construction', role: 'Site Engineer', from: '2016-07-01', to: '2023-11-30' }],
};

describe('RecordCard', () => {
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

  const render = async (record: object = RECORD) => {
    const fixture = TestBed.createComponent(RecordCard);
    await respond(http, { '/api/profile/record': record });
    return fixture.nativeElement as HTMLElement;
  };

  it('shows their bank details masked, with HR’s reason, and what HR keeps', async () => {
    const root = await render();

    expect(texts(root, 'my-bank')[0]).toBe('Bank details Bank of Maldives · Arjun Reddy · •••• 3456 · MVR Sent back: Name is cut off Sent back');
    expect(texts(root, 'my-insurance')[0]).toContain('None through Opro');
    expect(texts(root, 'my-education')).toEqual(['BTech Osmania University, 2016']);
    expect(texts(root, 'my-experience')).toEqual(['Site Engineer, L&T Construction 01 Jul 2016 to 30 Nov 2023']);
  });

  it('sends new bank details to HR, checking the number first', async () => {
    const root = await render({ education: [], experience: [] });
    expect(text(root.querySelector('[data-testid=open-bank]') as HTMLElement)).toBe('Add bank details');

    click(root, 'open-bank');
    fill(root, 'bank-name', 'Bank of Maldives');
    fill(root, 'bank-account-name', 'Arjun Reddy');
    fill(root, 'bank-number', '12ab');
    click(root, 'bank-submit');
    await settle();
    expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Use 6 to 40 digits.');

    fill(root, 'bank-number', '7730 0001 23456');
    fill(root, 'bank-currency', 'USD');
    click(root, 'bank-submit');
    await settle();
    const request = http.expectOne('/api/profile/bank-account');
    expect(request.request.body).toEqual({ bankName: 'Bank of Maldives', accountName: 'Arjun Reddy', accountNumber: '7730000123456', currency: 'USD' });
    request.flush({});
    await settle();

    expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Sent to HR');
    expect(http.match('/api/profile/record')).toHaveLength(1);
  });

  it('shows the server’s reason when it says no', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = await render();

    click(root, 'open-bank');
    fill(root, 'bank-name', 'BML');
    fill(root, 'bank-account-name', 'Arjun');
    fill(root, 'bank-number', '123456');
    click(root, 'bank-submit');
    await settle();
    http.expectOne('/api/profile/bank-account').flush({ message: 'Use MVR or USD' }, { status: 400, statusText: 'Bad Request' });
    await settle();

    expect(text(root.querySelector('[data-testid=bank-error]') as HTMLElement)).toBe('Use MVR or USD');
  });

  it('says so when the record fails to load', async () => {
    const fixture = TestBed.createComponent(RecordCard);
    await fail(http, '/api/profile/record');

    expect(text(fixture.nativeElement)).toContain("Your record didn't load");
  });
});
