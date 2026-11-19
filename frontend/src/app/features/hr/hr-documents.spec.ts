import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DocumentEntry, DocumentType } from '../../models/company';
import { click, fill, NOW, pdf, pickFile, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { DocumentTypesCard } from './document-types-card';
import { DocumentsToCheck } from './documents-to-check';
import { DocumentsToCollect } from './documents-to-collect';
import { HrDocumentsCard } from './hr-documents-card';

const PASSPORT: DocumentEntry = {
  type: 'passport-copy', name: 'Passport copy', uploadedBy: 'employee', hasExpiry: true, isForEveryone: true, status: 'pending', updatedOn: '2026-11-10',
  issuedOn: '2021-07-01', expiresOn: '2031-06-30', employeeId: 'OPR-0018', employeeName: 'Arjun Reddy',
  files: [{ id: 'DF-1', uploadedOn: '2026-11-10' }, { id: 'DF-2', uploadedOn: '2026-11-10' }],
};
const CONTRACT: DocumentEntry = { type: 'contract', name: 'Employment contract', uploadedBy: 'hr', hasExpiry: false, isForEveryone: true, status: 'missing', files: [] };
const MARRIAGE: DocumentEntry = { type: 'marriage', name: 'Marriage certificate', uploadedBy: 'employee', hasExpiry: false, isForEveryone: false, status: 'missing', files: [] };
const TYPES: DocumentType[] = [
  { code: 'passport-copy', name: 'Passport copy', uploadedBy: 'employee', hasExpiry: true, isForExpatriatesOnly: true, remindDaysBefore: 60, isForEveryone: true },
  { code: 'contract', name: 'Employment contract', uploadedBy: 'hr', hasExpiry: false, isForExpatriatesOnly: false, remindDaysBefore: 30, isForEveryone: true },
  { code: 'marriage', name: 'Marriage certificate', uploadedBy: 'employee', hasExpiry: false, isForExpatriatesOnly: false, remindDaysBefore: 30, isForEveryone: false },
  { code: 'old', name: 'Old form', uploadedBy: 'hr', hasExpiry: false, isForExpatriatesOnly: false, remindDaysBefore: 30, isForEveryone: true, retiredOn: '2026-01-01' },
];

describe('HR documents', () => {
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

  describe('HrDocumentsCard', () => {
    const LIST = '/api/hr/employees/OPR-0018/documents';
    const render = async (isOwn = false) => {
      const fixture = TestBed.createComponent(HrDocumentsCard);
      fixture.componentRef.setInput('employeeId', 'OPR-0018');
      fixture.componentRef.setInput('name', 'Arjun Reddy');
      fixture.componentRef.setInput('isOwn', isOwn);
      await respond(http, { [LIST]: [PASSPORT, CONTRACT, MARRIAGE], '/api/hr/document-types': TYPES });
      return fixture.nativeElement as HTMLElement;
    };

    it('lists their documents with a way to open, check and upload each', async () => {
      const root = await render();

      expect(texts(root, 'hr-document')).toEqual([
        'Passport copy From 01 Jul 2021, expires 30 Jun 2031 Page 1 Page 2 Waiting for HR Send back Verify Upload',
        'Employment contract HR adds this one Missing Upload',
        'Marriage certificate Upload a PDF, JPG or PNG Missing Upload Stop asking',
      ]);
      expect(root.querySelector('[data-testid=hr-document] a')?.getAttribute('href')).toBe('/api/hr/employees/OPR-0018/documents/passport-copy/files/DF-1');
    });

    it('takes a file off, and stops asking for a document only they were asked for', async () => {
      const root = await render();

      (root.querySelectorAll<HTMLButtonElement>('[data-testid=remove-file]')[1]).click();
      expect(http.expectOne('/api/hr/employees/OPR-0018/documents/passport-copy/files/DF-2').request.method).toBe('DELETE');

      click(root, 'stop-asking');
      expect(http.expectOne('/api/hr/employees/OPR-0018/document-types/marriage').request.method).toBe('DELETE');
    });

    it('asks them for a type HR gives one person at a time', async () => {
      const fixture = TestBed.createComponent(HrDocumentsCard);
      fixture.componentRef.setInput('employeeId', 'OPR-0018');
      fixture.componentRef.setInput('name', 'Arjun Reddy');
      await respond(http, { [LIST]: [PASSPORT, CONTRACT], '/api/hr/document-types': TYPES });
      const root = fixture.nativeElement as HTMLElement;

      expect([...root.querySelectorAll('[data-testid=ask-document] option')].map((option) => text(option))).toEqual(['Ask for a document…', 'Marriage certificate']);
      fill(root, 'ask-document', 'marriage');

      expect(http.expectOne('/api/hr/employees/OPR-0018/document-types/marriage').request.method).toBe('POST');
    });

    it('verifies in one click and sends back with a reason', async () => {
      const root = await render();

      click(root, 'verify');
      const verified = http.expectOne('/api/hr/employees/OPR-0018/documents/passport-copy/decision');
      expect(verified.request.body).toEqual({ decision: 'verified' });
      verified.flush({});
      await settle();
      http.expectOne(LIST).flush([PASSPORT, CONTRACT]);
      await settle();

      click(root, 'send-back');
      expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Send back the passport copy?');
      fill(root, 'decision-note', 'Photo page is cut off');
      click(root, 'confirm-reject');
      expect(http.expectOne('/api/hr/employees/OPR-0018/documents/passport-copy/decision').request.body).toEqual({ decision: 'rejected', note: 'Photo page is cut off' });
    });

    it('uploads a copy for them, counted as verified', async () => {
      const root = await render();
      [...root.querySelectorAll<HTMLButtonElement>('[data-testid=hr-upload]')][1].click();
      TestBed.tick();
      expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('It counts as verified straight away');

      pickFile(root, 'document-file', pdf('contract.pdf'));
      fill(root, 'document-issued', '2023-12-20');
      (root.querySelector('[data-testid=document-submit]') as HTMLButtonElement).click();
      await settle();
      http.expectOne('/api/hr/employees/OPR-0018/documents/contract/file?issuedOn=2023-12-20').flush({});
      await settle();

      expect(http.match(LIST)).toHaveLength(1);
    });

    it('offers nothing to do on their own page', async () => {
      const root = await render(true);

      expect(root.querySelector('[data-testid=verify]')).toBeNull();
      expect(root.querySelector('[data-testid=hr-upload]')).toBeNull();
      expect(root.querySelector('[data-testid=remove-file]')).toBeNull();
      expect(root.querySelector('[data-testid=ask-document]')).toBeNull();
    });
  });

  describe('DocumentsToCheck', () => {
    const render = async (waiting: DocumentEntry[] = [PASSPORT]) => {
      const fixture = TestBed.createComponent(DocumentsToCheck);
      await respond(http, { '/api/hr/documents': waiting });
      return fixture.nativeElement as HTMLElement;
    };

    it('lists uploads waiting across Opro and checks them', async () => {
      const root = await render();

      expect(texts(root, 'waiting-document')[0]).toContain('Arjun Reddy Passport copy · Submitted 2 days ago FILES Page 1 Page 2');
      click(root, 'send-back');
      expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Send back Arjun’s passport copy?');
      fill(root, 'decision-note', 'Expired passport');
      click(root, 'confirm-reject');
      expect(http.expectOne('/api/hr/employees/OPR-0018/documents/passport-copy/decision').request.body).toEqual({ decision: 'rejected', note: 'Expired passport' });
    });

    it('says when nothing is waiting', async () => {
      const root = await render([]);

      expect(text(root)).toContain('Nothing to check.');
    });
  });

  describe('DocumentTypesCard', () => {
    const render = async () => {
      const fixture = TestBed.createComponent(DocumentTypesCard);
      await respond(http, { '/api/hr/document-types': TYPES });
      return fixture.nativeElement as HTMLElement;
    };

    it('lists the active documents and adds one', async () => {
      const root = await render();
      expect(texts(root, 'doc-type-row')).toEqual([
        'Passport copy The employee Yes, reminds 60 days ahead Expatriates only Edit Remove',
        'Employment contract HR No Everyone Edit Remove',
        'Marriage certificate The employee No People HR asks Edit Remove',
      ]);

      click(root, 'add-doc-type');
      (root.querySelector('[data-testid=doc-type-submit]') as HTMLButtonElement).click();
      await settle();
      expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Give the document a name.');

      fill(root, 'doc-type-name', ' Police clearance ');
      fill(root, 'doc-type-who', 'expatriates');
      fill(root, 'doc-type-expires', 'yes');
      fill(root, 'doc-type-remind', '45');
      (root.querySelector('[data-testid=doc-type-submit]') as HTMLButtonElement).click();
      await settle();
      const added = http.expectOne('/api/hr/document-types');
      expect(added.request.body).toEqual({
        name: 'Police clearance', uploadedBy: 'employee', hasExpiry: true, isForExpatriatesOnly: true, isForEveryone: true, remindDaysBefore: 45,
      });
      added.flush({});
      await settle();
      expect(http.match('/api/hr/document-types')).toHaveLength(1);
    });

    it('edits one, shows the server’s reason, and removes one', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const root = await render();

      click(root, 'edit-doc-type');
      expect((root.querySelector('[data-testid=doc-type-name]') as HTMLInputElement).value).toBe('Passport copy');
      (root.querySelector('[data-testid=doc-type-submit]') as HTMLButtonElement).click();
      await settle();
      http.expectOne('/api/hr/document-types/passport-copy').flush({ message: "There's already a document called that." }, { status: 409, statusText: 'Conflict' });
      await settle();
      expect(text(root.querySelector('[data-testid=doc-type-error]') as HTMLElement)).toBe("There's already a document called that.");
      (root.querySelector('dialog[open] .secondary-button') as HTMLButtonElement).click();
      TestBed.tick();

      click(root, 'remove-doc-type');
      click(root, 'confirm-yes');
      const removal = http.expectOne('/api/hr/document-types/passport-copy');
      expect(removal.request.method).toBe('DELETE');
      removal.flush('', { status: 500, statusText: 'Server Error' });
      await settle();
      expect(text(root)).toContain("That didn't remove.");
    });
  });

  describe('DocumentsToCollect', () => {
    it('lists who still has to hand something in, and what', async () => {
      const fixture = TestBed.createComponent(DocumentsToCollect);
      await respond(http, {
        '/api/hr/documents/to-collect': [{ employeeId: 'OPR-0018', employeeName: 'Arjun Reddy', documents: [CONTRACT, { ...PASSPORT, status: 'expired' }] }],
      });
      const root = fixture.nativeElement as HTMLElement;

      expect(texts(root, 'to-collect')).toEqual(['AR Arjun Reddy Employment contract (missing), Passport copy (expired) 2']);
      expect(root.querySelector('[data-testid=to-collect]')?.getAttribute('href')).toBe('/hr/people/OPR-0018');
    });

    it('shows the first six, and the rest on request', async () => {
      const fixture = TestBed.createComponent(DocumentsToCollect);
      const people = Array.from({ length: 8 }, (_, index) => ({ employeeId: `OPR-${index}`, employeeName: `Person ${index}`, documents: [CONTRACT] }));
      await respond(http, { '/api/hr/documents/to-collect': people });
      const root = fixture.nativeElement as HTMLElement;
      expect(texts(root, 'to-collect')).toHaveLength(6);

      click(root, 'show-all-to-collect');

      expect(texts(root, 'to-collect')).toHaveLength(8);
      expect(text(root.querySelector('[data-testid=show-all-to-collect]') as HTMLElement)).toBe('Show fewer');
    });

    it('says when everyone has handed everything in', async () => {
      const fixture = TestBed.createComponent(DocumentsToCollect);
      await respond(http, { '/api/hr/documents/to-collect': [] });

      expect(text(fixture.nativeElement)).toContain('Everyone has handed in everything on the list.');
    });
  });
});
