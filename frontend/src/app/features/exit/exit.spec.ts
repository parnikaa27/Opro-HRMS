import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Resignation } from '../../models/exit';
import { click, fail, fill, NOW, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { ExitCard } from './exit-card';
import { ExitItemsCard } from './exit-items-card';
import { ResignationCard } from './resignation-card';
import { ResignationsToDecide } from './resignations-to-decide';

const PENDING: Resignation = {
  id: 'RS-1', employeeId: 'OPR-0018', employeeName: 'Arjun Reddy', submittedOn: '2026-11-10', reason: 'Moving back home', releaseOn: '2026-12-31',
  status: 'pending', checklist: [],
};
const APPROVED: Resignation = {
  ...PENDING, status: 'approved', exitOn: '2027-01-07', hodApprovedByName: 'Vikram Singh', hodApprovedOn: '2026-11-10',
  checklist: [
    { itemId: 'EI-1', name: 'Laptop', outcome: 'returned', tickedOn: '2026-11-11' },
    { itemId: 'EI-2', name: 'ID card', outcome: 'not-given', tickedOn: '2026-11-11' },
    { itemId: 'EI-4', name: 'Accommodation keys' },
  ],
};

describe('exit', () => {
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

  describe('ResignationCard', () => {
    const render = async (resignations: Resignation[]) => {
      const fixture = TestBed.createComponent(ResignationCard);
      await respond(http, { '/api/resignation': resignations });
      return fixture.nativeElement as HTMLElement;
    };

    it('puts in a resignation with the last day they would like', async () => {
      const root = await render([]);

      click(root, 'resign');
      click(root, 'resign-submit');
      await settle();
      expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Pick the last day you’d like.');

      fill(root, 'resign-date', '2026-12-31');
      fill(root, 'resign-reason', ' Moving back home ');
      click(root, 'resign-submit');
      await settle();
      const sent = http.expectOne('/api/resignation');
      expect(sent.request.body).toEqual({ releaseOn: '2026-12-31', reason: 'Moving back home' });
      sent.flush(PENDING);
      await settle();

      expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Resignation sent');
    });

    it('shows the server’s reason when it refuses', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const root = await render([]);
      click(root, 'resign');
      fill(root, 'resign-date', '2026-12-31');
      fill(root, 'resign-reason', 'Moving');
      click(root, 'resign-submit');
      await settle();

      http.expectOne('/api/resignation').flush({ message: 'HR has already set your last day.' }, { status: 409, statusText: 'Conflict' });
      await settle();

      expect(text(root.querySelector('[data-testid=resign-error]') as HTMLElement)).toBe('HR has already set your last day.');
    });

    it('says where a waiting one stands, and withdraws it', async () => {
      const root = await render([PENDING]);

      expect(text(root.querySelector('[data-testid=resignation-status]') as HTMLElement)).toBe(
        'You resigned on 10 November 2026, asking for 31 December 2026 as your last day. It’s with your HOD.',
      );
      click(root, 'withdraw-resignation');
      click(root, 'confirm-yes');

      expect(http.expectOne('/api/resignation/RS-1/withdraw').request.method).toBe('POST');
    });

    it('shows the exit date and what is still to hand back', async () => {
      const root = await render([APPROVED]);

      expect(text(root.querySelector('[data-testid=exit-date]') as HTMLElement)).toContain('Your exit date is 7 January 2027.');
      expect(texts(root, 'exit-item')).toEqual(['Laptop Returned', 'ID card Never given', 'Accommodation keys Still with you']);
    });

    it('says why the last one was declined, and lets them try again', async () => {
      const root = await render([{ ...PENDING, status: 'rejected', decidedByName: 'Vikram Singh', decisionNote: 'Stay till the project ends' }]);

      expect(text(root.querySelector('[data-testid=resignation-declined]') as HTMLElement)).toBe("Vikram Singh didn't accept your last one: “Stay till the project ends”");
      expect(root.querySelector('[data-testid=resign]')).not.toBeNull();
    });
  });

  describe('ExitCard', () => {
    const render = async (isOwn = false) => {
      const fixture = TestBed.createComponent(ExitCard);
      fixture.componentRef.setInput('employeeId', 'OPR-0018');
      fixture.componentRef.setInput('resignation', APPROVED);
      fixture.componentRef.setInput('isOwn', isOwn);
      const changed = vi.fn();
      fixture.componentInstance.changed.subscribe(changed);
      await fixture.whenStable();
      return { root: fixture.nativeElement as HTMLElement, changed };
    };

    it('ticks an item off as returned or never given, and undoes one', async () => {
      const { root, changed } = await render();
      expect(texts(root, 'exit-item')).toEqual(['Laptop Returned Undo', 'ID card Never given Undo', 'Accommodation keys Still with them Returned Never given']);

      click(root, 'not-given');
      const ticked = http.expectOne('/api/hr/employees/OPR-0018/exit/items/EI-4');
      expect([ticked.request.method, ticked.request.body]).toEqual(['PUT', { outcome: 'not-given' }]);
      ticked.flush({});
      await settle();
      expect(changed).toHaveBeenCalled();

      click(root, 'untick');
      expect(http.expectOne('/api/hr/employees/OPR-0018/exit/items/EI-1').request.method).toBe('DELETE');
    });

    it('offers nothing to tick on their own page', async () => {
      const { root } = await render(true);

      expect(root.querySelector('[data-testid=returned]')).toBeNull();
    });
  });

  describe('ResignationsToDecide', () => {
    const render = async () => {
      const fixture = TestBed.createComponent(ResignationsToDecide);
      await respond(http, { '/api/hr/resignations': [{ ...PENDING, hodApprovedByName: 'Vikram Singh', hodApprovedOn: '2026-11-11' }] });
      return fixture.nativeElement as HTMLElement;
    };

    it('approves with the exit date, starting on the day they asked for', async () => {
      const root = await render();
      expect(texts(root, 'waiting-resignation')[0]).toContain('Arjun Reddy Approved by Vikram Singh · “Moving back home” Last day asked for 31 December 2026');

      click(root, 'approve');
      expect((root.querySelector('[data-testid=exit-date-input]') as HTMLInputElement).value).toBe('2026-12-31');
      fill(root, 'exit-date-input', '2027-01-07');
      click(root, 'confirm-approve');

      expect(http.expectOne('/api/hr/resignations/RS-1/decision').request.body).toEqual({ decision: 'approved', exitOn: '2027-01-07' });
    });

    it('declines with a reason', async () => {
      const root = await render();

      click(root, 'reject');
      fill(root, 'decision-note', 'Contract runs to January');
      click(root, 'confirm-reject');

      expect(http.expectOne('/api/hr/resignations/RS-1/decision').request.body).toEqual({ decision: 'rejected', note: 'Contract runs to January' });
    });

    it('says when nothing is waiting, and when it failed to load', async () => {
      const empty = TestBed.createComponent(ResignationsToDecide);
      await respond(http, { '/api/hr/resignations': [] });
      expect(text(empty.nativeElement)).toContain('No resignations waiting for HR.');

      const broken = TestBed.createComponent(ResignationsToDecide);
      await fail(http, '/api/hr/resignations');
      expect(text(broken.nativeElement)).toContain("Resignations didn't load.");
    });
  });

  describe('ExitItemsCard', () => {
    const render = async () => {
      const fixture = TestBed.createComponent(ExitItemsCard);
      await respond(http, { '/api/hr/exit-items': [{ id: 'EI-1', name: 'Laptop' }, { id: 'EI-2', name: 'ID card' }] });
      return fixture.nativeElement as HTMLElement;
    };

    it('lists what comes back, adds one and removes one', async () => {
      const root = await render();
      expect(texts(root, 'exit-item-row')).toEqual(['Laptop Remove', 'ID card Remove']);

      fill(root, 'exit-item-name', ' Parking pass ');
      click(root, 'add-exit-item');
      await settle();
      const added = http.expectOne('/api/hr/exit-items');
      expect(added.request.body).toEqual({ name: 'Parking pass' });
      added.flush({ id: 'EI-5', name: 'Parking pass' });
      await settle();
      http.expectOne('/api/hr/exit-items').flush([]);
      await settle();
      expect((root.querySelector('[data-testid=exit-item-name]') as HTMLInputElement).value).toBe('');
    });

    it('removes one, and says why an add was refused', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const root = await render();

      click(root, 'remove-exit-item');
      click(root, 'confirm-yes');
      expect(http.expectOne('/api/hr/exit-items/EI-1').request.method).toBe('DELETE');

      fill(root, 'exit-item-name', 'Laptop');
      click(root, 'add-exit-item');
      await settle();
      http.expectOne((request) => request.method === 'POST').flush({ message: "That's already on the list." }, { status: 409, statusText: 'Conflict' });
      await settle();
      expect(text(root.querySelector('[role=alert]') as HTMLElement)).toBe("That's already on the list.");
    });
  });
});
