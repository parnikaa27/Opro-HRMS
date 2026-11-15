import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, maxLength, pattern, required } from '@angular/forms/signals';
import { Employee } from '../../../models/employee';
import { FieldError } from '../../../shared/ui/field-error';
import { serverReason, submitForm } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const MAX_FIELD = 120;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const LOCATIONS = ['Malé office', 'Hulhumalé site'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract'];
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
            <option value="" [selected]="draft().managerId === ''">{{ isTopOfCompany() ? 'Nobody, they lead the company' : 'Pick their manager' }}</option>
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

      <h2>Personal</h2>
      <div class="form-row">
        <label>Phone <input type="tel" [formField]="employeeForm.phone" data-testid="employee-phone" aria-describedby="employee-phone-error" /></label>
        <label>Nationality <input [formField]="employeeForm.nationality" data-testid="employee-nationality" aria-describedby="employee-nationality-error" /></label>
      </div>
      <app-field-error id="employee-phone-error" [errors]="employeeForm.phone().errors()" [isTouched]="employeeForm.phone().touched()" />
      <app-field-error id="employee-nationality-error" [errors]="employeeForm.nationality().errors()" [isTouched]="employeeForm.nationality().touched()" />
      <label>
        Blood group
        <select [formField]="employeeForm.bloodGroup" data-testid="employee-blood">
          @for (group of bloodGroups; track group) {
            <option [value]="group" [selected]="draft().bloodGroup === group">{{ group }}</option>
          }
        </select>
      </label>

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
  // Only the person at the very top has no manager, so only they can be saved without one.
  protected readonly isTopOfCompany = computed(() => this.employee() !== undefined && !this.employee()?.managerId);
  protected readonly departments = computed(() => [...new Set(this.people().map(({ department }) => department))].sort());
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
    required(path.managerId, { message: 'Pick who they report to.', when: () => !this.isTopOfCompany() });
  });

  protected save(event: Event) {
    this.problem.set(undefined);
    return submitForm(event, this.employeeForm, this.failed, async () => {
      const { contactName, contactRelation, contactPhone, managerId, ...work } = this.draft();
      // The server trims and validates every field again.
      const details = { ...work, emergencyContact: { name: contactName, relation: contactRelation, phone: contactPhone }, ...(managerId && { managerId }) };
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
