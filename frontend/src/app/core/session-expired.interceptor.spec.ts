import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { employee } from '../../testing/fixtures';
import { Session } from './session';
import { sessionExpiredInterceptor } from './session-expired.interceptor';

describe('sessionExpiredInterceptor', () => {
  let http: HttpTestingController;
  let session: Session;
  let clear: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([sessionExpiredInterceptor])), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    clear = vi.spyOn(session, 'clear').mockImplementation(() => undefined);
  });

  const request = (status: number) => {
    const call = firstValueFrom(TestBed.inject(HttpClient).get('/api/leave/balances'));
    http.expectOne('/api/leave/balances').flush('', { status, statusText: 'Error' });
    return call;
  };

  it('signs the user out when their session has expired', async () => {
    session.user.set(employee());

    await expect(request(401)).rejects.toBeTruthy();
    expect(clear).toHaveBeenCalled();
  });

  it('leaves other errors alone', async () => {
    session.user.set(employee());

    await expect(request(500)).rejects.toBeTruthy();
    expect(clear).not.toHaveBeenCalled();
  });

  it('does nothing when nobody was signed in yet', async () => {
    await expect(request(401)).rejects.toBeTruthy();
    expect(clear).not.toHaveBeenCalled();
  });
});
