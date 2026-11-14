import { TestBed } from '@angular/core/testing';
import { Visa } from '../../models/employee';
import { NOW, text } from '../../../testing/fixtures';
import { VisaDetails } from './visa-details';

const VISA: Visa = {
  workPermitNumber: 'WP-2023-204117',
  visaNumber: 'MV-EV-602388',
  passportLast4: '7730',
  visaIssuedOn: '2024-12-21',
  visaExpiry: '2026-12-20',
  passportExpiry: '2028-02-11',
};

describe('VisaDetails', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  const render = async (visa: Visa | undefined, nationality = 'Sri Lankan') => {
    const fixture = TestBed.createComponent(VisaDetails);
    fixture.componentRef.setInput('visa', visa);
    fixture.componentRef.setInput('nationality', nationality);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('shows each document with its status, counting down only when it matters', async () => {
    const root = await render(VISA);

    const documents = [...root.querySelectorAll('[data-testid=visa-document]')].map((row) => text(row));
    expect(documents).toEqual([
      'Work visa MV-EV-602388 Issued 21 December 2024, expires 20 December 2026 Expires soon 38 days left',
      'Passport Ending 7730 Expires 11 February 2028 Valid',
    ]);
    expect(text(root)).toContain('Work permit WP-2023-204117');
  });

  it('says how long ago an expired visa ran out', async () => {
    const root = await render({ ...VISA, visaExpiry: '2026-11-02' });

    expect(text(root.querySelector('[data-testid=visa-document]') as HTMLElement)).toContain('Expired 10 days ago');
  });

  it('tells Maldivians they need nothing, and asks others to send their papers', async () => {
    expect(text((await render(undefined, 'Maldivian')).querySelector('[data-testid=visa-none]') as HTMLElement)).toContain('Not needed');
    expect(text((await render(undefined)).querySelector('[data-testid=visa-none]') as HTMLElement)).toContain('Send a copy to HR');
  });
});
