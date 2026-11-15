import { TestBed } from '@angular/core/testing';
import { Visa } from '../../models/employee';
import { NOW, text, texts } from '../../../testing/fixtures';
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

  const render = async (visa: Visa | undefined, nationality = 'Indian') => {
    const fixture = TestBed.createComponent(VisaDetails);
    fixture.componentRef.setInput('visa', visa);
    fixture.componentRef.setInput('nationality', nationality);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('lists visa, passport and permit, counting down only when it matters', async () => {
    expect(texts(await render(VISA), 'visa-document')).toEqual([
      'Work visa MV-EV-602388 · Issued 21 December 2024, expires 20 December 2026 38 days left Expires soon',
      'Passport Ending 7730 · Expires 11 February 2028 Valid',
      'Work permit WP-2023-204117',
    ]);
  });

  it('says how long ago an expired visa ran out', async () => {
    expect(texts(await render({ ...VISA, visaExpiry: '2026-11-02' }), 'visa-document')[0]).toContain('10 days ago Expired');
  });

  it('tells Maldivians they need nothing, and asks others to send their papers', async () => {
    expect(text((await render(undefined, 'Maldivian')).querySelector('[data-testid=visa-none]') as HTMLElement)).toContain('Not needed');
    expect(text((await render(undefined)).querySelector('[data-testid=visa-none]') as HTMLElement)).toContain('Send a copy to HR');
  });
});
