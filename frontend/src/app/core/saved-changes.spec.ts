import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SavedChanges, savedChangesInterceptor } from './saved-changes';

describe('savedChangesInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let count: () => number;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([savedChangesInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    count = TestBed.inject(SavedChanges).count;
  });

  it('counts successful saves only', async () => {
    const read = firstValueFrom(client.get('/api/me'));
    http.expectOne('/api/me').flush({});
    await read;
    expect(count()).toBe(0);

    const save = firstValueFrom(client.post('/api/hr/announcements', {}));
    http.expectOne('/api/hr/announcements').flush({});
    await save;
    expect(count()).toBe(1);

    const failing = firstValueFrom(client.delete('/api/hr/holidays/HD-1'));
    http.expectOne('/api/hr/holidays/HD-1').flush('', { status: 500, statusText: 'Server Error' });
    await expect(failing).rejects.toBeDefined();
    expect(count()).toBe(1);
  });
});
