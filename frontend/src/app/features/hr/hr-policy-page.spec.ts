import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { click, fail, respond, setupHttp, text, texts } from '../../../testing/fixtures';
import { HrPolicyPage } from './hr-policy-page';

const URL = '/api/leave/types';
const TYPES = [
  { code: 'annual', name: 'Annual leave', allowsHalfDay: true, defaultEntitlement: 30 },
  { code: 'paternity', name: 'Paternity leave', allowsHalfDay: false, defaultEntitlement: 1 },
  { code: 'unpaid', name: 'Unpaid leave', allowsHalfDay: false, isUnlimited: true },
];

describe('HrPolicyPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttp();
  });

  it('shows each type’s yearly days and half day rule', async () => {
    const fixture = TestBed.createComponent(HrPolicyPage);
    await respond(http, { [URL]: TYPES });

    expect(texts(fixture.nativeElement, 'policy-row')).toEqual([
      'Annual leave 30 days Allowed Edit',
      'Paternity leave 1 day Full days only Edit',
      'Unpaid leave No limit Full days only Edit',
    ]);
  });

  it('edits a type in a dialog and reloads after saving', async () => {
    const fixture = TestBed.createComponent(HrPolicyPage);
    await respond(http, { [URL]: TYPES });
    const root = fixture.nativeElement as HTMLElement;

    click(root, 'edit-policy');
    (root.querySelector('dialog button[type=submit]') as HTMLButtonElement).click();
    await respond(http, {});
    http.expectOne('/api/hr/leave-types/annual').flush({});
    await respond(http, { [URL]: TYPES });

    expect(root.querySelector('dialog')?.open).toBe(false);
  });

  it('says when the policy fails to load', async () => {
    const fixture = TestBed.createComponent(HrPolicyPage);
    await fail(http, URL);

    expect(text(fixture.nativeElement)).toContain("The leave policy didn't load");
  });
});
