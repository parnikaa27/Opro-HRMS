import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DocumentEntry, DocumentType } from '../../models/company';
import { click, fill, NOW, pdf, pickFile, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { DocumentTypesCard } from './document-types-card';
import { DocumentsToCheck } from './documents-to-check';
import { HrDocumentsCard } from './hr-documents-card';

const PASSPORT: DocumentEntry = {
  type: 'passport-copy', name: 'Passport copy', uploadedBy: 'employee', hasExpiry: true, status: 'pending', hasFile: true, updatedOn: '2026-11-10',
  expiresOn: '2031-06-30', employeeId: 'OPR-0018', employeeName: 'Arjun Reddy',
};
const CONTRACT: DocumentEntry = { type: 'contract', name: 'Employment contract', uploadedBy: 'hr', hasExpiry: false, status: 'missing', hasFile: false };
const TYPES: DocumentType[] = [
  { code: 'passport-copy', name: 'Passport copy', uploadedBy: 'employee', hasExpiry: true, isForExpatriatesOnly: true },
  { code: 'contract', name: 'Employment contract', uploadedBy: 'hr', hasExpiry: false, isForExpatriatesOnly: false },
  { code: 'old', name: 'Old form', uploadedBy: 'hr', hasExpiry: false, isForExpatriatesOnly: false, retiredOn: '2026-01-01' },
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
      await respond(http, { [LIST]: [PASSPORT, CONTRACT] });
      return fixture.nativeElement as HTMLElement;
    };

    it('lists their documents with a way to open, check and upload each', async () => {
      const root = await render();

      expect(texts(root, 'hr-document')).toEqual([
        'Passport copy Expires 30 Jun 2031 Waiting for HR View Send back Verify Upload',
        'Employment contract HR adds this one Missing Upload',
      ]);
      expect(root.querySelector('[data-testid=hr-document] a')?.getAttribute('href')).toBe('/api/hr/employees/OPR-0018/documents/passport-copy/file');
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
      (root.querySelector('[data-testid=document-submit]') as HTMLButtonElement).click();
      await settle();
      http.expectOne('/api/hr/employees/OPR-0018/documents/contract/file').flush({});
      await settle();

      expect(http.match(LIST)).toHaveLength(1);
    });

    it('offers nothing to do on their own page', async () => {
      const root = await render(true);

      expect(root.querySelector('[data-testid=verify]')).toBeNull();
      expect(root.querySelector('[data-testid=hr-upload]')).toBeNull();
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

      expect(texts(root, 'waiting-document')[0]).toContain('Arjun Reddy Passport copy · Submitted 2 days ago FILE Open');
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
        'Passport copy The employee Yes Expatriates only Edit Remove',
        'Employment contract HR No Everyone Edit Remove',
      ]);

      click(root, 'add-doc-type');
      (root.querySelector('[data-testid=doc-type-submit]') as HTMLButtonElement).click();
      await settle();
      expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Give the document a name.');

      fill(root, 'doc-type-name', ' Police clearance ');
      fill(root, 'doc-type-who', 'expatriates');
      (root.querySelector('[data-testid=doc-type-submit]') as HTMLButtonElement).click();
      await settle();
      const added = http.expectOne('/api/hr/document-types');
      expect(added.request.body).toEqual({ name: 'Police clearance', uploadedBy: 'employee', hasExpiry: false, isForExpatriatesOnly: true });
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
});
