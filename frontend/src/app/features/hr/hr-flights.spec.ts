import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FlightClaim, FlightYear } from '../../models/flight';
import { click, fill, NOW, respond, settle, setupHttp, text } from '../../../testing/fixtures';
import { HrFlightCard } from './hr-flight-card';

const CLAIM: FlightClaim = {
  id: 'FC-2', employeeId: 'OPR-0015', employeeName: 'Priya Nair', flightDate: '2026-11-02', route: 'Malé to Kochi and back', amount: 26400, currency: 'INR', amountUsd: 300,
  hasReceipt: true, status: 'approved', raisedOn: '2026-11-10',
};
const YEAR: FlightYear = { year: 2026, allowanceUsd: 900, usedUsd: 300, ratesPerUsd: { MVR: 15.42, INR: 88 }, claims: [CLAIM] };

describe('HR flights', () => {
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

  describe('HrFlightCard', () => {
    const render = async () => {
      const fixture = TestBed.createComponent(HrFlightCard);
      fixture.componentRef.setInput('employeeId', 'OPR-0015');
      await respond(http, { '/api/hr/employees/OPR-0015/flights': YEAR });
      return fixture.nativeElement as HTMLElement;
    };

    it('sets this year’s allowance and shows their claims with HR’s receipt link', async () => {
      const root = await render();
      expect(root.querySelector('[data-testid=flight-claim] a')?.getAttribute('href')).toBe('/api/hr/flight-claims/FC-2/receipt');
      expect(root.querySelector('[data-testid=cancel-claim]')).toBeNull();

      fill(root, 'allowance-amount', '1100');
      click(root, 'allowance-submit');
      await settle();
      const request = http.expectOne('/api/hr/employees/OPR-0015/flight-allowance');
      expect(request.request.body).toEqual({ year: 2026, amountUsd: 1100 });
      request.flush(null);
      await settle();

      expect(http.match('/api/hr/employees/OPR-0015/flights')).toHaveLength(1);
    });

    it('says why an allowance was refused', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const root = await render();

      fill(root, 'allowance-amount', '100');
      click(root, 'allowance-submit');
      await settle();
      http.expectOne('/api/hr/employees/OPR-0015/flight-allowance').flush({ message: "They've already claimed $300.00 for 2026, so it can't go below that." }, { status: 409, statusText: 'Conflict' });
      await settle();

      expect(text(root.querySelector('[role=alert]') as HTMLElement)).toBe("They've already claimed $300.00 for 2026, so it can't go below that.");
    });
  });
});
