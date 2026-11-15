import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { employee, fail, respond, settle, setupHttp, text } from '../../../testing/fixtures';
import { EmployeeForm } from './forms/employee-form';
import { HrEmployeePage } from './hr-employee-page';

describe('HrEmployeePage', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    http = setupHttp();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => vi.restoreAllMocks());

  it('adds a person and opens their page', async () => {
    const fixture = TestBed.createComponent(HrEmployeePage);
    await respond(http, { '/api/hr/employees': [employee()] });

    expect(text(fixture.nativeElement.querySelector('h1'))).toBe('Add a person');
    fixture.debugElement.query(By.directive(EmployeeForm)).componentInstance.saved.emit(employee({ id: 'OPR-0028' }));
    expect(navigate).toHaveBeenCalledWith(['/hr/people', 'OPR-0028']);
  });

  it('edits someone and goes back to their page on cancel', async () => {
    const fixture = TestBed.createComponent(HrEmployeePage);
    fixture.componentRef.setInput('employeeId', 'OPR-0018');
    await respond(http, { '/api/hr/employees': [employee()], '/api/hr/employees/OPR-0018': employee() });

    expect(text(fixture.nativeElement.querySelector('h1'))).toBe('Edit Kasun’s details');
    fixture.debugElement.query(By.directive(EmployeeForm)).componentInstance.cancelled.emit();
    await settle();
    expect(navigate).toHaveBeenCalledWith(['/hr/people', 'OPR-0018']);
  });

  it('says when their details fail to load', async () => {
    const fixture = TestBed.createComponent(HrEmployeePage);
    fixture.componentRef.setInput('employeeId', 'OPR-0018');
    await respond(http, { '/api/hr/employees': [] });
    await fail(http, '/api/hr/employees/OPR-0018');

    expect(text(fixture.nativeElement)).toContain("Their details didn't load");
  });
});
