import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../core/session';
import { fail, respond, setupHttp } from '../../../testing/fixtures';
import { LoginPage } from './login-page';

const people = [
  { id: 'OPR-0018', fullName: 'Kasun Perera', designation: 'Site Engineer', roles: ['EMPLOYEE'] },
  { id: 'OPR-0004', fullName: 'Ibrahim Rasheed', designation: 'Operations Manager', roles: ['EMPLOYEE', 'MANAGER'] },
];

describe('LoginPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttp();
  });

  afterEach(() => vi.restoreAllMocks());

  const render = async () => {
    const fixture = TestBed.createComponent(LoginPage);
    await respond(http, { '/api/session/users': people });
    return fixture.nativeElement as HTMLElement;
  };

  it('lists managers first', async () => {
    const element = await render();

    const ids = [...element.querySelectorAll('[data-testid^=login-as-]')].map((button) => button.getAttribute('data-testid'));
    expect(ids).toEqual(['login-as-OPR-0004', 'login-as-OPR-0018']);
  });

  it('signs in as the chosen person', async () => {
    const signIn = vi.spyOn(TestBed.inject(Session), 'signIn').mockResolvedValue();
    const element = await render();

    (element.querySelector('[data-testid=login-as-OPR-0018]') as HTMLButtonElement).click();

    expect(signIn).toHaveBeenCalledWith('OPR-0018');
  });

  it('says so when sign in fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(TestBed.inject(Session), 'signIn').mockRejectedValue(new Error('nope'));
    const element = await render();

    (element.querySelector('[data-testid=login-as-OPR-0018]') as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();

    expect(element.querySelector('[role=alert]')).not.toBeNull();
  });

  it('explains when the server cannot be reached', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    await fail(http, '/api/session/users');

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid=login-load-error]')).not.toBeNull();
  });
});
