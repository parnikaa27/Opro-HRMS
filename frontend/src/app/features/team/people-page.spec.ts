import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { click, employee, fail, fill, respond, setupHttp, text, texts } from '../../../testing/fixtures';
import { PeoplePage } from './people-page';

const MEMBERS = [
  { ...employee({ id: 'B', fullName: 'Priya Nair', designation: 'Procurement Officer' }), today: { status: 'late' } },
  { ...employee({ id: 'A', fullName: 'Karan Mehta', designation: 'Customer Service Lead' }) },
];

describe('PeoplePage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttp();
  });

  it('shows everyone by name with today’s status, and filters by name or role', async () => {
    const fixture = TestBed.createComponent(PeoplePage);
    await respond(http, { '/api/team': MEMBERS });
    const root = fixture.nativeElement as HTMLElement;

    expect(texts(root, 'person-card').map((card) => card.split(' arjun')[0])).toEqual([
      'KM Not in yet Karan Mehta Customer Service Lead',
      'PN Late Priya Nair Procurement Officer',
    ]);
    expect(root.querySelector('[data-testid=person-card] a')?.getAttribute('href')).toBe('/team/A');

    fill(root, 'people-search', 'procure');
    expect(texts(root, 'person-card')).toHaveLength(1);

    fill(root, 'people-search', 'nobody');
    expect(text(root)).toContain('Nobody matches “nobody”.');
  });

  it('shows everyone at Opro for HR, linking to the HR person page', async () => {
    const fixture = TestBed.createComponent(PeoplePage);
    fixture.componentRef.setInput('scope', 'hr');
    await respond(http, { '/api/hr/employees': MEMBERS });
    const root = fixture.nativeElement as HTMLElement;

    expect(text(root.querySelector('.page-title') as HTMLElement)).toContain('Everyone at Opro and where they are today.');
    expect(root.querySelector('[data-testid=person-card] a')?.getAttribute('href')).toBe('/hr/people/A');
    expect(root.querySelector('[data-testid=add-person]')?.getAttribute('href')).toBe('/hr/people/new');
    http.expectNone('/api/team');
  });

  it('shows a super admin where everyone is today, linking to their read only page', async () => {
    const at = (workMode: string, status = 'present') => ({ status, workMode, punches: [{ at: '2026-11-12T09:00:00+05:00', direction: 'in' }] });
    const fixture = TestBed.createComponent(PeoplePage);
    fixture.componentRef.setInput('scope', 'company');
    await respond(http, {
      '/api/company': [
        { ...employee({ id: 'A', fullName: 'Karan Mehta' }), today: at('office') },
        { ...employee({ id: 'B', fullName: 'Priya Nair' }), today: at('home', 'late') },
        { ...employee({ id: 'C', fullName: 'Arjun Reddy' }), today: at('resort') },
        { ...employee({ id: 'D', fullName: 'Rohit Verma' }), today: at('home', 'absent') },
        { ...employee({ id: 'E', fullName: 'Kavya Menon' }), today: { status: 'on-leave', punches: [] } },
        employee({ id: 'F', fullName: 'Sneha Kulkarni' }),
      ],
    });
    const root = fixture.nativeElement as HTMLElement;

    expect(text(root.querySelector('[data-testid=where-today]') as HTMLElement)).toBe('1 at the office 1 from home 1 at a resort 1 on leave 2 not in');
    expect(root.querySelector('[data-testid=person-card] a')?.getAttribute('href')).toBe('/company/C');
    expect(root.querySelector('[data-testid=add-person]')).toBeNull();
    http.expectNone('/api/team');
  });

  it('lets HR include people who have left, marked as such', async () => {
    const fixture = TestBed.createComponent(PeoplePage);
    fixture.componentRef.setInput('scope', 'hr');
    await respond(http, { '/api/hr/employees': MEMBERS });
    const root = fixture.nativeElement as HTMLElement;

    click(root, 'show-former');
    await respond(http, { '/api/hr/employees?include=former': [...MEMBERS, employee({ id: 'G', fullName: 'Kavya Menon', lastDay: '2026-11-01' })] });

    expect(texts(root, 'person-card').find((card) => card.includes('Kavya'))).toContain('Left 01 Nov 2026');
  });

  it('has an empty state and an error state', async () => {
    const empty = TestBed.createComponent(PeoplePage);
    await respond(http, { '/api/team': [] });
    expect(text(empty.nativeElement)).toContain('Nobody reports to you yet.');

    const broken = TestBed.createComponent(PeoplePage);
    await fail(http, '/api/team');
    expect(text(broken.nativeElement)).toContain("Your team didn't load");
  });
});
