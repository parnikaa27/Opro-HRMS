import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fill, setupHttp, settle, text } from '../../../testing/fixtures';
import { ChangeRequestForm } from './change-request-form';

describe('ChangeRequestForm', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttp();
  });

  afterEach(() => vi.restoreAllMocks());

  const render = async () => {
    const fixture = TestBed.createComponent(ChangeRequestForm);
    let sent = 0;
    fixture.componentInstance.sent.subscribe(() => sent++);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const submitForm = async () => {
      (root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { cancelable: true }));
      await settle();
    };
    return { root, submitForm, sentCount: () => sent };
  };

  it('needs the new details before sending', async () => {
    const { root, submitForm } = await render();

    await submitForm();

    expect(text(root.querySelector('.field-error') as HTMLElement)).toBe('Tell HR what the new details are.');
    http.expectNone('/api/profile/change-requests');
  });

  it('sends what to change and the new value', async () => {
    const { root, submitForm, sentCount } = await render();
    fill(root, 'change-field', 'Emergency contact');
    fill(root, 'change-details', ' Amit Kulkarni, father, +960 777 2011 ');
    await submitForm();

    const request = http.expectOne('/api/profile/change-requests');
    expect(request.request.body).toEqual({ field: 'Emergency contact', details: 'Amit Kulkarni, father, +960 777 2011' });
    request.flush(null);
    await settle();
    expect(sentCount()).toBe(1);
  });

  it('says so when sending fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { root, submitForm, sentCount } = await render();
    fill(root, 'change-details', '+960 777 9999');
    await submitForm();

    http.expectOne('/api/profile/change-requests').flush('', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(root.querySelector('[role=alert]')).not.toBeNull();
    expect(sentCount()).toBe(0);
  });
});
