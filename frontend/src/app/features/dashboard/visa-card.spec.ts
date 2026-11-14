import { TestBed } from '@angular/core/testing';
import { Visa } from '../../models/employee';
import { employee, NOW, text } from '../../../testing/fixtures';
import { VisaCard } from './visa-card';

const VISA: Visa = { workPermitNumber: 'W', visaNumber: 'MV-EV-1', passportLast4: '1234', visaIssuedOn: '2025-11-12', visaExpiry: '2027-11-12', passportExpiry: '2030-01-01' };

describe('VisaCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  const render = async (overrides: Parameters<typeof employee>[0]) => {
    const fixture = TestBed.createComponent(VisaCard);
    fixture.componentRef.setInput('employee', employee(overrides));
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('shows a valid visa with time left and how much of it is used', async () => {
    const root = await render({ visa: VISA });

    expect(text(root)).toBe('WORK VISA Visa status Valid Employment Visa MV-EV-1 Expiry date 12 Nov 2027 Time remaining 365 days No action needed right now');
    expect((root.querySelector('.progress-track i') as HTMLElement).style.width).toBe('50%');
  });

  it('warns about an expiring visa, an expired one, and a passport running out', async () => {
    expect(text(await render({ visa: { ...VISA, visaExpiry: '2026-12-01' } }))).toContain('Expires soon');
    const expired = await render({ visa: { ...VISA, visaExpiry: '2026-11-02' } });
    expect(text(expired)).toContain('Expired 10 days ago');
    expect(text(expired)).toContain('Speak to HR today');
    expect(text(await render({ visa: { ...VISA, passportExpiry: '2026-12-01' } }))).toContain('Your passport expires on 1 December 2026. Start the renewal.');
  });

  it('handles nationals and missing records', async () => {
    expect(text(await render({ nationality: 'Maldivian' }))).toContain("Not needed Maldivian nationals don't need a work visa.");
    expect(text(await render({}))).toContain("Missing We don't have your visa on record.");
  });

  it('copes with a visa issued and expiring on the same day', async () => {
    const root = await render({ visa: { ...VISA, visaIssuedOn: '2027-11-12' } });

    expect((root.querySelector('.progress-track i') as HTMLElement).style.width).toBe('100%');
  });
});
