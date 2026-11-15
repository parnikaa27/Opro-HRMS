import { TestBed } from '@angular/core/testing';
import { employee, text } from '../../../testing/fixtures';
import { EmployeeCard } from './employee-card';

describe('EmployeeCard', () => {
  it('shows who they are and how to reach them', async () => {
    const fixture = TestBed.createComponent(EmployeeCard);
    fixture.componentRef.setInput('employee', employee());
    await fixture.whenStable();

    expect(text(fixture.nativeElement)).toBe(
      'O EMPLOYEE AR Arjun Reddy Site Engineer OPR-0018 arjun.reddy@opro.mv +960 777 1018 Operations · Contract Active employee OPRO · MALDIVES',
    );
  });

  it('shows their photo in place of initials once HR adds one', async () => {
    const fixture = TestBed.createComponent(EmployeeCard);
    fixture.componentRef.setInput('employee', employee({ photoUrl: '/api/employees/OPR-0018/photo?v=1' }));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid=staff-photo]')?.getAttribute('src')).toBe('/api/employees/OPR-0018/photo?v=1');
    expect(fixture.nativeElement.querySelector('.portrait-initials')).toBeNull();
  });
});
