import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fail, respond, setupHttp, text, texts } from '../../../testing/fixtures';
import { DocumentsPage } from './documents-page';

describe('DocumentsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttp();
  });

  it('lists documents with their dates, status and a download link', async () => {
    const fixture = TestBed.createComponent(DocumentsPage);
    await respond(http, {
      '/api/documents': [
        { id: 'contract', name: 'Employment contract', updatedOn: '2025-01-12', status: 'verified' },
        { id: 'visa', name: 'Visa copy', expiresOn: '2026-03-31', status: 'verified' },
        { id: 'national-id', name: 'National ID', status: 'verified' },
        { id: 'insurance', name: 'Health insurance', status: 'pending' },
      ],
    });
    const root = fixture.nativeElement as HTMLElement;

    expect(texts(root, 'document')).toEqual([
      'Employment contract PDF · Updated 12 Jan 2025 Verified',
      'Visa copy PDF · Expires 31 Mar 2026 Verified',
      'National ID PDF · Verified Verified',
      'Health insurance PDF · Waiting for HR Pending',
    ]);
    expect(root.querySelector('[data-testid=document] a')?.getAttribute('href')).toBe('/api/documents/contract/file');
  });

  it('has an empty state and an error state', async () => {
    const empty = TestBed.createComponent(DocumentsPage);
    await respond(http, { '/api/documents': [] });
    expect(text(empty.nativeElement)).toContain('No documents yet.');

    const broken = TestBed.createComponent(DocumentsPage);
    await fail(http, '/api/documents');
    expect(text(broken.nativeElement)).toContain("Your documents didn't load");
  });
});
