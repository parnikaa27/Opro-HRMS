import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FlightYear } from '../../models/flight';
import { click, fill, NOW, pdf, pickFile, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { FlightCard } from './flight-card';

const YEAR: FlightYear = {
  year: 2026,
  allowanceUsd: 1200,
  usedUsd: 500,
  ratesPerUsd: { MVR: 15.42, INR: 88 },
  claims: [
    { id: 'FC-2', employeeId: 'E', flightDate: '2026-12-18', route: 'Malé to Colombo', amount: 1542, currency: 'MVR', amountUsd: 100, hasReceipt: true, status: 'approved', raisedOn: '2026-11-12' },
    { id: 'FC-1', employeeId: 'E', flightDate: '2026-04-10', route: 'Malé to Kochi', amount: 400, currency: 'USD', amountUsd: 400, hasReceipt: false, status: 'rejected', raisedOn: '2026-04-12', decisionNote: 'Wrong receipt' },
  ],
};

describe('FlightCard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
    localStorage.removeItem('opro.currency');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const render = async (year: FlightYear = YEAR) => {
    const fixture = TestBed.createComponent(FlightCard);
    await respond(http, { '/api/flights': year });
    return fixture.nativeElement as HTMLElement;
  };

  const openForm = (root: HTMLElement) => {
    click(root, 'open-claim');
    fill(root, 'claim-route', 'Malé to Colombo and back');
    fill(root, 'claim-date', '2026-12-18');
    fill(root, 'claim-amount', '200');
  };

  it('shows the allowance, what is used and left, and every claim', async () => {
    const root = await render();

    expect(text(root.querySelector('[data-testid=flight-stats]') as HTMLElement)).toBe('Allowance 2026 $1,200.00 Used $500.00 Left $700.00');
    expect(texts(root, 'flight-claim')).toEqual([
      'Malé to Colombo 18 Dec · MVR 1,542.00 ($100.00) Claimed Receipt Cancel',
      'Malé to Kochi 10 Apr · $400.00 · Wrong receipt Declined',
    ]);
  });

  it('switches currency with HR’s rates and remembers the choice', async () => {
    const root = await render();

    click(root, 'currency-MVR');

    expect(text(root.querySelector('[data-testid=flight-left]') as HTMLElement)).toBe('MVR 10,794.00');
    expect(localStorage.getItem('opro.currency')).toBe('MVR');
    click(root, 'currency-INR');
    expect(text(root.querySelector('[data-testid=flight-left]') as HTMLElement)).toBe('₹61,600.00');
  });

  it('stays hidden for someone with no allowance and no claims', async () => {
    const root = await render({ ...YEAR, allowanceUsd: undefined, claims: [] });

    expect(root.querySelector('[data-testid=flight-card]')).toBeNull();
  });

  it('claims a flight with its receipt, counted straight away', async () => {
    const root = await render();
    openForm(root);
    pickFile(root, 'claim-receipt', pdf('ticket.pdf'));
    click(root, 'claim-submit');
    await settle();

    const claim = http.expectOne('/api/flights/claims');
    expect(claim.request.body).toEqual({ route: 'Malé to Colombo and back', flightDate: '2026-12-18', amount: 200, currency: 'USD' });
    claim.flush({ id: 'FC-9' });
    await settle();
    http.expectOne('/api/flights/claims/FC-9/receipt').flush({});
    await settle();

    expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Flight claimed');
    (root.querySelector('[data-testid=success-state] button') as HTMLButtonElement).click();
    await settle();
    expect(http.match('/api/flights')).toHaveLength(1);
  });

  it('says what went wrong: over the allowance, or the receipt alone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = await render();
    openForm(root);
    click(root, 'claim-submit');
    await settle();
    http.expectOne('/api/flights/claims').flush({ message: "That's $900.00, more than the $700.00 you have left for 2026." }, { status: 409, statusText: 'Conflict' });
    await settle();
    expect(text(root.querySelector('[data-testid=claim-error]') as HTMLElement)).toBe("That's $900.00, more than the $700.00 you have left for 2026.");

    pickFile(root, 'claim-receipt', pdf('ticket.pdf'));
    click(root, 'claim-submit');
    await settle();
    http.expectOne('/api/flights/claims').flush({ id: 'FC-9' });
    await settle();
    http.expectOne('/api/flights/claims/FC-9/receipt').flush('', { status: 500, statusText: 'Error' });
    await settle();
    expect(text(root.querySelector('[data-testid=claim-error]') as HTMLElement)).toContain("Your claim is in, but the receipt didn't upload.");
  });

  it('refuses a receipt that is not a PDF or picture, before uploading', async () => {
    const root = await render();
    click(root, 'open-claim');

    pickFile(root, 'claim-receipt', new File(['x'], 'notes.txt', { type: 'text/plain' }));

    expect(text(root.querySelector('#claim-receipt-note') as HTMLElement)).toBe('Attach a PDF, JPG or PNG under 5 MB.');
  });

  it('cancels a claim that is still waiting', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = await render();

    click(root, 'cancel-claim');
    http.expectOne('/api/flights/claims/FC-2/cancel').flush('', { status: 500, statusText: 'Error' });
    await settle();
    expect(text(root)).toContain("That didn't cancel.");

    click(root, 'cancel-claim');
    http.expectOne('/api/flights/claims/FC-2/cancel').flush({});
    await settle();
    expect(http.match('/api/flights')).toHaveLength(1);
  });
});
