import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DocumentEntry } from '../../models/company';
import { click, fail, fill, NOW, pdf, pickFile, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { DocumentsPage } from './documents-page';

const entry = (overrides: Partial<DocumentEntry>): DocumentEntry => ({
  type: 'contract', name: 'Employment contract', uploadedBy: 'hr', hasExpiry: false, status: 'verified', hasFile: true, ...overrides,
});
const DOCUMENTS = [
  entry({ updatedOn: '2025-01-12' }),
  entry({ type: 'visa-copy', name: 'Visa copy', hasExpiry: true, expiresOn: '2026-10-31', status: 'expired' }),
  entry({ type: 'passport-copy', name: 'Passport copy', uploadedBy: 'employee', hasExpiry: true, status: 'rejected', decisionNote: 'Photo page is cut off' }),
  entry({ type: 'certificates', name: 'Educational certificates', uploadedBy: 'employee', status: 'pending', updatedOn: '2026-11-11' }),
  entry({ type: 'insurance', name: 'Health insurance', status: 'missing', hasFile: false }),
];

describe('DocumentsPage', () => {
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

  const render = async () => {
    const fixture = TestBed.createComponent(DocumentsPage);
    await respond(http, { '/api/documents': DOCUMENTS });
    return fixture.nativeElement as HTMLElement;
  };

  it('lists every document with where it stands, and uploads only for the ones the employee sends', async () => {
    const root = await render();

    expect(texts(root, 'document')).toEqual([
      'Employment contract Updated 12 Jan 2025 Verified',
      'Visa copy Expired 31 Oct 2026 Expired',
      'Passport copy Sent back: Photo page is cut off Upload a new copy Sent back',
      'Educational certificates Updated 11 Nov 2026 Upload a new copy Waiting for HR',
      'Health insurance HR adds this one Missing',
    ]);
    expect(root.querySelector('[data-testid=document] a')?.getAttribute('href')).toBe('/api/documents/contract/file');
    expect(root.querySelectorAll('[data-testid=document]')[4].querySelector('a')).toBeNull();
  });

  it('uploads a new passport copy with its expiry date, then reloads', async () => {
    const root = await render();
    click(root, 'upload-document');

    (root.querySelector('[data-testid=document-submit]') as HTMLButtonElement).click();
    await settle();
    expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Pick the file to upload.');
    expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Enter the date it expires.');

    pickFile(root, 'document-file', pdf('passport.pdf'));
    fill(root, 'document-expiry', '2031-06-30');
    (root.querySelector('[data-testid=document-submit]') as HTMLButtonElement).click();
    await settle();
    const upload = http.expectOne('/api/documents/passport-copy/file?expiresOn=2031-06-30');
    expect(upload.request.method).toBe('PUT');
    upload.flush({});
    await settle();

    expect(root.querySelector('dialog[open]')).toBeNull();
    expect(http.match('/api/documents')).toHaveLength(1);
  });

  it('shows why an upload was refused', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = await render();
    [...root.querySelectorAll<HTMLButtonElement>('[data-testid=upload-document]')][1].click();
    TestBed.tick();

    pickFile(root, 'document-file', new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(text(root.querySelector('#document-file-note') as HTMLElement)).toBe('Attach a PDF, JPG or PNG under 5 MB.');
    pickFile(root, 'document-file', pdf());
    (root.querySelector('[data-testid=document-submit]') as HTMLButtonElement).click();
    await settle();
    http.expectOne('/api/documents/certificates/file').flush({ message: 'Document type not found' }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(text(root.querySelector('[data-testid=document-error]') as HTMLElement)).toBe('Document type not found');
  });

  it('has an empty state and an error state', async () => {
    const empty = TestBed.createComponent(DocumentsPage);
    await respond(http, { '/api/documents': [] });
    expect(text(empty.nativeElement)).toContain("HR hasn't listed any documents yet.");

    const broken = TestBed.createComponent(DocumentsPage);
    await fail(http, '/api/documents');
    expect(text(broken.nativeElement)).toContain("Your documents didn't load");
  });
});
