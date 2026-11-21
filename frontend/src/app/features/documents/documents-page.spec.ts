import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DocumentEntry } from '../../models/company';
import { click, fail, fill, NOW, pdf, pickFile, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { DocumentsPage } from './documents-page';

const entry = (overrides: Partial<DocumentEntry>): DocumentEntry => ({
  type: 'contract', name: 'Employment contract', uploadedBy: 'hr', hasExpiry: false, isForEveryone: true, status: 'verified', files: [{ id: 'DF-1', uploadedOn: '2025-01-12' }],
  ...overrides,
});
const DOCUMENTS = [
  entry({ updatedOn: '2025-01-12' }),
  entry({ type: 'visa-copy', name: 'Visa copy', hasExpiry: true, expiresOn: '2026-10-31', status: 'expired' }),
  entry({ type: 'passport-copy', name: 'Passport copy', uploadedBy: 'employee', hasExpiry: true, status: 'rejected', decisionNote: 'Photo page is cut off' }),
  entry({
    type: 'certificates', name: 'Educational certificates', uploadedBy: 'employee', status: 'pending', issuedOn: '2020-05-01', updatedOn: '2026-11-11',
    files: [{ id: 'DF-2', uploadedOn: '2026-11-11' }, { id: 'DF-3', uploadedOn: '2026-11-11' }],
  }),
  entry({ type: 'police-clearance', name: 'Police clearance', status: 'missing', files: [] }),
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
      'Employment contract Updated 12 Jan 2025 Download Verified',
      'Visa copy Expired 31 Oct 2026 Download Expired',
      'Passport copy Sent back: Photo page is cut off Download Add a page or a new copy Sent back',
      'Educational certificates From 01 May 2020 Page 1 Page 2 Add a page or a new copy Waiting for HR',
      'Police clearance HR adds this one Missing',
    ]);
    expect(root.querySelector('[data-testid=document] a')?.getAttribute('href')).toBe('/api/documents/contract/files/DF-1');
    expect(root.querySelectorAll('[data-testid=document]')[4].querySelector('a')).toBeNull();
  });

  it('takes a wrong file off until HR has verified the copy', async () => {
    const root = await render();
    // Only the copies still with them (sent back, or waiting) have crosses: 1 + 2 files.
    expect(root.querySelectorAll('[data-testid=remove-file]')).toHaveLength(3);

    (root.querySelectorAll<HTMLButtonElement>('[data-testid=remove-file]')[2]).click();
    const removal = http.expectOne('/api/documents/certificates/files/DF-3');
    expect(removal.request.method).toBe('DELETE');
    removal.flush({});
    await settle();

    expect(http.match('/api/documents')).toHaveLength(1);
  });

  it('uploads both pages of a new passport copy with its dates, one after the other, then reloads', async () => {
    const root = await render();
    click(root, 'upload-document');

    (root.querySelector('[data-testid=document-submit]') as HTMLButtonElement).click();
    await settle();
    expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Pick the file to upload.');
    expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Enter the date it starts.');
    expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Enter the date it expires.');

    const input = root.querySelector('[data-testid=document-file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [pdf('front.pdf'), pdf('back.pdf')], configurable: true });
    input.dispatchEvent(new Event('change'));
    fill(root, 'document-issued', '2021-07-01');
    fill(root, 'document-expiry', '2031-06-30');
    (root.querySelector('[data-testid=document-submit]') as HTMLButtonElement).click();
    await settle();
    const first = http.expectOne('/api/documents/passport-copy/file?issuedOn=2021-07-01&expiresOn=2031-06-30');
    expect(first.request.method).toBe('PUT');
    first.flush({});
    await settle();
    http.expectOne('/api/documents/passport-copy/file?issuedOn=2021-07-01&expiresOn=2031-06-30').flush({});
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
    // Starts with the copy on file's date, so another page goes on the same copy.
    http.expectOne('/api/documents/certificates/file?issuedOn=2020-05-01').flush({ message: 'Document type not found' }, { status: 409, statusText: 'Conflict' });
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
