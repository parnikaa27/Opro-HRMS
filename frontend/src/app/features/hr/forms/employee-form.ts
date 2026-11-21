import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, maxLength, pattern, required, validate } from '@angular/forms/signals';
import { Employee, EmploymentType, Gender } from '../../../models/employee';
import { FieldError } from '../../../shared/ui/field-error';
import { maldivesToday } from '../../../shared/utils/date-time';
import { serverReason, submitForm } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const MAX_FIELD = 120;
const MINIMUM_AGE = 18;
const YEAR_LENGTH = 4;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const LOCATIONS = ['Malé office', 'Hulhumalé site'];
const EMPLOYMENT_TYPES: readonly EmploymentType[] = ['Permanent', 'Contract', 'Casual', 'Intern'];
const TEXT_FIELDS = [
  ['fullName', 'Enter their full name.'],
  ['designation', 'Enter their job title.'],
  ['department', 'Enter their department.'],
  ['phone', 'Enter their phone number.'],
  ['nationality', 'Enter their nationality.'],
  ['contactName', 'Enter who to call in an emergency.'],
  ['contactRelation', 'Say how they’re related.'],
  ['contactPhone', 'Enter a number to call.'],
] as const;

// Everyone below a person, so they can't be picked as that person's manager.
const below = (people: readonly Employee[], id: string): string[] =>
  people.filter(({ managerId }) => managerId === id).flatMap((report) => [report.id, ...below(people, report.id)]);

@Component({
  selector: 'app-employee-form',
  imports: [FieldError, FormField],
  template: `
    <form novalidate (submit)="save($event)" class="card card-pad employee-form">
      <h2>Work</h2>
      <div class="form-row">
        <label>Full name <input [formField]="employeeForm.fullName" autocomplete="off" data-testid="employee-name" aria-describedby="employee-fullName-error" /></label>
        <label>Designation <input [formField]="employeeForm.designation" data-testid="employee-designation" aria-describedby="employee-designation-error" /></label>
      </div>
      <app-field-error id="employee-fullName-error" [errors]="employeeForm.fullName().errors()" [isTouched]="employeeForm.fullName().touched()" />
      <app-field-error id="employee-designation-error" [errors]="employeeForm.designation().errors()" [isTouched]="employeeForm.designation().touched()" />
      <div class="form-row">
        <label>Department <input [formField]="employeeForm.department" list="departments" data-testid="employee-department" aria-describedby="employee-department-error" /></label>
        <label>
          Manager
          <select [formField]="employeeForm.managerId" data-testid="employee-manager" aria-describedby="employee-managerId-error">
            <option value="" [selected]="draft().managerId === ''">{{ isSuperAdmin() ? 'Nobody, they’re a super admin' : 'Pick their reporting manager' }}</option>
            @for (manager of managers(); track manager.id) {
              <option [value]="manager.id" [selected]="draft().managerId === manager.id">{{ manager.fullName }}, {{ manager.designation }}</option>
            }
          </select>
        </label>
      </div>
      <datalist id="departments">
        @for (department of departments(); track department) {
          <option [value]="department"></option>
        }
      </datalist>
      <app-field-error id="employee-department-error" [errors]="employeeForm.department().errors()" [isTouched]="employeeForm.department().touched()" />
      <app-field-error id="employee-managerId-error" [errors]="employeeForm.managerId().errors()" [isTouched]="employeeForm.managerId().touched()" />
      <div class="form-row">
        <label>
          Work location
          <select [formField]="employeeForm.workLocation" data-testid="employee-location">
            @for (location of locations; track location) {
              <option [value]="location" [selected]="draft().workLocation === location">{{ location }}</option>
            }
          </select>
        </label>
        <label>
          Employment
          <select [formField]="employeeForm.employmentType" data-testid="employee-type">
            @for (type of employmentTypes; track type) {
              <option [value]="type" [selected]="draft().employmentType === type">{{ type }}</option>
            }
          </select>
        </label>
      </div>
      <div class="form-row">
        <label>Work email <input type="email" [formField]="employeeForm.email" data-testid="employee-email" aria-describedby="employee-email-error" /></label>
        <label>Joined on <input type="date" [formField]="employeeForm.joinedOn" data-testid="employee-joined" aria-describedby="employee-joinedOn-error" /></label>
      </div>
      <app-field-error id="employee-email-error" [errors]="employeeForm.email().errors()" [isTouched]="employeeForm.email().touched()" />
      <app-field-error id="employee-joinedOn-error" [errors]="employeeForm.joinedOn().errors()" [isTouched]="employeeForm.joinedOn().touched()" />
      <div class="form-row">
        <label>Probation ends <input type="date" [formField]="employeeForm.probationEndsOn" data-testid="employee-probation" aria-describedby="employee-probationEndsOn-error" /></label>
        @if (draft().employmentType === 'Contract') {
          <label>Contract ends <input type="date" [formField]="employeeForm.contractEndsOn" data-testid="employee-contract-end" aria-describedby="employee-contractEndsOn-error" /></label>
        }
      </div>
      <app-field-error id="employee-probationEndsOn-error" [errors]="employeeForm.probationEndsOn().errors()" [isTouched]="employeeForm.probationEndsOn().touched()" />
      <app-field-error id="employee-contractEndsOn-error" [errors]="employeeForm.contractEndsOn().errors()" [isTouched]="employeeForm.contractEndsOn().touched()" />

      <h2>Personal</h2>
      <div class="form-row">
        <label>Phone <input type="tel" [formField]="employeeForm.phone" data-testid="employee-phone" aria-describedby="employee-phone-error" /></label>
        <label>Nationality <input [formField]="employeeForm.nationality" data-testid="employee-nationality" aria-describedby="employee-nationality-error" /></label>
      </div>
      <app-field-error id="employee-phone-error" [errors]="employeeForm.phone().errors()" [isTouched]="employeeForm.phone().touched()" />
      <app-field-error id="employee-nationality-error" [errors]="employeeForm.nationality().errors()" [isTouched]="employeeForm.nationality().touched()" />
      <div class="form-row">
        <label>
          Gender
          <select [formField]="employeeForm.gender" data-testid="employee-gender" aria-describedby="employee-gender-error">
            <option value="" [selected]="draft().gender === ''">Pick one</option>
            <option value="female" [selected]="draft().gender === 'female'">Female</option>
            <option value="male" [selected]="draft().gender === 'male'">Male</option>
          </select>
        </label>
        <label>Date of birth <input type="date" [formField]="employeeForm.dateOfBirth" data-testid="employee-birth" aria-describedby="employee-dateOfBirth-error" /></label>
      </div>
      <app-field-error id="employee-gender-error" [errors]="employeeForm.gender().errors()" [isTouched]="employeeForm.gender().touched()" />
      <app-field-error id="employee-dateOfBirth-error" [errors]="employeeForm.dateOfBirth().errors()" [isTouched]="employeeForm.dateOfBirth().touched()" />
      <div class="form-row">
        <label>
          Blood group
          <select [formField]="employeeForm.bloodGroup" data-testid="employee-blood">
            @for (group of bloodGroups; track group) {
              <option [value]="group" [selected]="draft().bloodGroup === group">{{ group }}</option>
            }
          </select>
        </label>
        <label>Quota job category <input [formField]="employeeForm.jobCategory" list="job-categories" placeholder="For expatriates" data-testid="employee-category" /></label>
      </div>
      <datalist id="job-categories">
        @for (category of jobCategories(); track category) {
          <option [value]="category"></option>
        }
      </datalist>

      <h2>Emergency contact</h2>
      <div class="form-row">
        <label>Name <input [formField]="employeeForm.contactName" data-testid="employee-contact-name" aria-describedby="employee-contactName-error" /></label>
        <label>Relation <input [formField]="employeeForm.contactRelation" placeholder="Spouse" data-testid="employee-contact-relation" aria-describedby="employee-contactRelation-error" /></label>
      </div>
      <app-field-error id="employee-contactName-error" [errors]="employeeForm.contactName().errors()" [isTouched]="employeeForm.contactName().touched()" />
      <app-field-error id="employee-contactRelation-error" [errors]="employeeForm.contactRelation().errors()" [isTouched]="employeeForm.contactRelation().touched()" />
      <label>Phone <input type="tel" [formField]="employeeForm.contactPhone" data-testid="employee-contact-phone" aria-describedby="employee-contactPhone-error" /></label>
      <app-field-error id="employee-contactPhone-error" [errors]="employeeForm.contactPhone().errors()" [isTouched]="employeeForm.contactPhone().touched()" />

      @if (failed()) {
        <p role="alert" class="field-error">{{ problem() ?? "That didn't save. Try again in a moment." }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="employeeForm().submitting()" data-testid="employee-submit">{{ employee() ? 'Save changes' : 'Add to Opro' }}</button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeForm {
  private readonly api = inject(HrApi);
  // Missing when adding someone new.
  readonly employee = input<Employee>();
  readonly people = input.required<readonly Employee[]>();
  readonly saved = output<Employee>();
  readonly cancelled = output();

  protected readonly locations = LOCATIONS;
  protected readonly employmentTypes = EMPLOYMENT_TYPES;
  protected readonly bloodGroups = BLOOD_GROUPS;
  protected readonly failed = signal(false);
  protected readonly problem = signal<string | undefined>(undefined);
  // Everyone reports to someone except a super admin, so only they can be saved without a manager.
  protected readonly isSuperAdmin = computed(() => this.employee()?.roles.includes('SUPER_ADMIN') ?? false);
  protected readonly departments = computed(() => [...new Set(this.people().map(({ department }) => department))].sort());
  protected readonly jobCategories = computed(() => [...new Set(this.people().flatMap(({ jobCategory }) => (jobCategory ? [jobCategory] : [])))].sort());
  private readonly today = maldivesToday();
  protected readonly managers = computed(() => {
    const id = this.employee()?.id;
    const blocked = new Set(id ? [id, ...below(this.people(), id)] : []);
    return this.people()
      .filter((person) => !blocked.has(person.id))
      .sort((first, second) => first.fullName.localeCompare(second.fullName));
  });

  protected readonly draft = linkedSignal(() => {
    const employee = this.employee();
    return {
      fullName: employee?.fullName ?? '',
      designation: employee?.designation ?? '',
      department: employee?.department ?? '',
      managerId: employee?.managerId ?? '',
      workLocation: employee?.workLocation ?? LOCATIONS[0],
      employmentType: employee?.employmentType ?? EMPLOYMENT_TYPES[0],
      email: employee?.email ?? '',
      joinedOn: employee?.joinedOn ?? '',
      phone: employee?.phone ?? '',
      nationality: employee?.nationality ?? '',
      bloodGroup: employee?.bloodGroup ?? BLOOD_GROUPS[0],
      contactName: employee?.emergencyContact.name ?? '',
      contactRelation: employee?.emergencyContact.relation ?? '',
      contactPhone: employee?.emergencyContact.phone ?? '',
      gender: (employee?.gender ?? '') as Gender | '',
      dateOfBirth: employee?.dateOfBirth ?? '',
      probationEndsOn: employee?.probationEndsOn ?? '',
      contractEndsOn: employee?.contractEndsOn ?? '',
      jobCategory: employee?.jobCategory ?? '',
    };
  });
  protected readonly employeeForm = form(this.draft, (path) => {
    TEXT_FIELDS.forEach(([field, message]) => {
      required(path[field], { message });
      maxLength(path[field], MAX_FIELD, { message: `Keep it under ${MAX_FIELD} characters.` });
    });
    required(path.email, { message: 'Enter their work email.' });
    pattern(path.email, EMAIL, { message: 'That doesn’t look like an email address.' });
    required(path.joinedOn, { message: 'Pick the day they start.' });
    required(path.managerId, { message: 'Pick their reporting manager.', when: () => !this.isSuperAdmin() });
    required(path.gender, { message: 'Pick their gender.' });
    required(path.dateOfBirth, { message: 'Enter their date of birth.' });
    validate(path.dateOfBirth, ({ value }) => (value() && value() >= this.today ? { kind: 'future', message: 'That date hasn’t happened yet.' } : undefined));
    // The server says the same: at least 18 on their joining day.
    validate(path.dateOfBirth, ({ value, valueOf }) => {
      const turnsOfAge = value() && `${Number(value().slice(0, YEAR_LENGTH)) + MINIMUM_AGE}${value().slice(YEAR_LENGTH)}`;
      return turnsOfAge && valueOf(path.joinedOn) && turnsOfAge > valueOf(path.joinedOn)
        ? { kind: 'too-young', message: `They need to be ${MINIMUM_AGE} by their joining date.` }
        : undefined;
    });
    const afterJoining = (message: string) => ({ value, valueOf }: { value: () => string; valueOf: (field: typeof path.joinedOn) => string }) =>
      value() && valueOf(path.joinedOn) && value() <= valueOf(path.joinedOn) ? { kind: 'order', message } : undefined;
    validate(path.probationEndsOn, afterJoining('Probation ends after they join.'));
    validate(path.contractEndsOn, afterJoining('The contract ends after they join.'));
  });

  protected save(event: Event) {
    this.problem.set(undefined);
    return submitForm(event, this.employeeForm, this.failed, async () => {
      const { contactName, contactRelation, contactPhone, managerId, gender, probationEndsOn, contractEndsOn, jobCategory, ...work } = this.draft();
      const isContract = work.employmentType === 'Contract';
      // The server trims and validates every field again. Empty optional dates and the category are left out.
      const details = {
        ...work,
        gender: gender || undefined,
        emergencyContact: { name: contactName, relation: contactRelation, phone: contactPhone },
        ...(managerId && { managerId }),
        ...(probationEndsOn && { probationEndsOn }),
        ...(isContract && contractEndsOn && { contractEndsOn }),
        ...(jobCategory.trim() && { jobCategory: jobCategory.trim() }),
      };
      const id = this.employee()?.id;
      try {
        this.saved.emit(await (id ? this.api.updateEmployee(id, details) : this.api.addEmployee(details)));
      } catch (error) {
        this.problem.set(serverReason(error));
        throw error;
      }
    });
  }
}
