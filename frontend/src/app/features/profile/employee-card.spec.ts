import { TestBed } from '@angular/core/testing';
import { employee, text } from '../../../testing/fixtures';
import { EmployeeCard } from './employee-card';

describe('EmployeeCard', () => {
  it('shows who they are and how to reach them', async () => {
    const fixture = TestBed.createComponent(EmployeeCard);
    fixture.componentRef.setInput('employee', employee());
    await fixture.whenStable();

    expect(text(fixture.nativeElement)).toBe(
      'O EMPLOYEE KP Kasun Perera Site Engineer OPR-0018 kasun.perera@opro.mv +960 777 1018 Operations · Contract Active employee OPRO · MALDIVES',
    );
  });
});
