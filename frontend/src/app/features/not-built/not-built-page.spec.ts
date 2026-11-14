import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { NotBuiltPage } from './not-built-page';

describe('NotBuiltPage', () => {
  it('names the page from the route title', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { title: 'Leave · Opro HRMS' } } }],
    });
    const fixture = TestBed.createComponent(NotBuiltPage);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toBe('Leave');
  });
});
