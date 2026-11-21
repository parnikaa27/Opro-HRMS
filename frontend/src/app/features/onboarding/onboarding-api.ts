import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Onboarding, OnboardingTask, TaskOwner } from '../../models/onboarding';

const enc = encodeURIComponent;

export const OWNERS: Record<TaskOwner, string> = { hr: 'HR', hod: 'HOD', joiner: 'Joiner' };

// "3 days before joining", "On their first day", "7 days after joining"
export const describeDue = (days: number) =>
  days === 0 ? 'On their first day' : `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ${days < 0 ? 'before' : 'after'} joining`;

export const progress = ({ items }: Pick<Onboarding, 'items'>) => `${items.filter(({ doneOn }) => doneOn).length} of ${items.length} done`;

@Injectable({ providedIn: 'root' })
export class OnboardingApi {
  private readonly http = inject(HttpClient);
  private readonly send = <T>(method: 'POST' | 'PUT' | 'DELETE', url: string, body?: object) => firstValueFrom(this.http.request<T>(method, url, { body }));

  // Empty (204) when they aren't onboarding.
  mine = () => httpResource<Onboarding | null>(() => '/api/onboarding');
  team = () => httpResource<Onboarding[]>(() => '/api/team/onboarding', { defaultValue: [] });
  inProgress = () => httpResource<Onboarding[]>(() => '/api/hr/onboarding', { defaultValue: [] });
  of = (employeeId: () => string) => httpResource<Onboarding | null>(() => `/api/hr/employees/${enc(employeeId())}/onboarding`);

  tick = (employeeId: string, itemId: string, isDone: boolean) =>
    this.send<Onboarding>(isDone ? 'POST' : 'DELETE', `/api/onboarding/${enc(employeeId)}/items/${enc(itemId)}/done`, isDone ? {} : undefined);
  start = (employeeId: string) => this.send<Onboarding>('POST', `/api/hr/employees/${enc(employeeId)}/onboarding`, {});
  setFirstDay = (employeeId: string, firstDay: { time?: string; place?: string; contact?: string }) =>
    this.send<Onboarding>('PUT', `/api/hr/employees/${enc(employeeId)}/onboarding/first-day`, firstDay);
  setBuddy = (employeeId: string, buddyId: string) => this.send<Onboarding>('PUT', `/api/team/onboarding/${enc(employeeId)}/buddy`, { buddyId });

  tasks = () => httpResource<OnboardingTask[]>(() => '/api/hr/onboarding-tasks', { defaultValue: [] });
  addTask = (task: Omit<OnboardingTask, 'id'>) => this.send<OnboardingTask>('POST', '/api/hr/onboarding-tasks', task);
  removeTask = (id: string) => this.send<void>('DELETE', `/api/hr/onboarding-tasks/${enc(id)}`);
}
