import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Routes } from '@angular/router';
import { Employee } from '../app/models/employee';

export const TODAY = '2026-11-12';
export const NOW = new Date('2026-11-12T10:30:00+05:00');

export const employee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'OPR-0018',
  fullName: 'Arjun Reddy',
  designation: 'Site Engineer',
  department: 'Operations',
  email: 'arjun.reddy@opro.mv',
  phone: '+960 777 1018',
  joinedOn: '2023-12-20',
  bloodGroup: 'O-',
  nationality: 'Indian',
  workLocation: 'Hulhumalé site',
  employmentType: 'Contract',
  managerId: 'OPR-0004',
  roles: ['EMPLOYEE'],
  emergencyContact: { name: 'Lakshmi Reddy', relation: 'Spouse', phone: '+94 77 120 1018' },
  ...overrides,
});

export const manager = (overrides: Partial<Employee> = {}) =>
  employee({ id: 'OPR-0004', fullName: 'Vikram Singh', roles: ['EMPLOYEE', 'MANAGER'], ...overrides });

export const setupHttp = (routes: Routes = []) => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)] });
  return TestBed.inject(HttpTestingController);
};

// Lets pending resources fire their requests, answers the matching ones, then renders.
export const respond = async (http: HttpTestingController, responses: Record<string, object>) => {
  TestBed.tick();
  Object.entries(responses).forEach(([url, body]) => http.match((request) => request.urlWithParams === url).forEach((request) => request.flush(body)));
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
};

export const fail = async (http: HttpTestingController, url: string) => {
  TestBed.tick();
  http.match((request) => request.urlWithParams === url).forEach((request) => request.flush('boom', { status: 500, statusText: 'Server Error' }));
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
};

// Joins text nodes with spaces, since Angular strips the whitespace between elements.
const textNodes = (node: Node): string[] => (node.nodeType === Node.TEXT_NODE ? [node.textContent ?? ''] : [...node.childNodes].flatMap(textNodes));
export const text = (node: Node) => textNodes(node).map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');

export const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
};

export const fill = (root: HTMLElement, testId: string, value: string) => {
  const field = root.querySelector(`[data-testid=${testId}]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  TestBed.tick();
};

export const click = (root: HTMLElement, testId: string) => {
  (root.querySelector(`[data-testid=${testId}]`) as HTMLElement).click();
  TestBed.tick();
};

export const byTestId = (root: HTMLElement, testId: string) => [...root.querySelectorAll<HTMLElement>(`[data-testid=${testId}]`)];
export const texts = (root: HTMLElement, testId: string) => byTestId(root, testId).map((element) => text(element));

// jsdom has no DataTransfer, so a picked file is set on the input directly.
export const pickFile = (root: HTMLElement, testId: string, file: File) => {
  const input = root.querySelector(`[data-testid=${testId}]`) as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  TestBed.tick();
};

export const pdf = (name = 'certificate.pdf', size = 0) => new File([size ? new Uint8Array(size) : '%PDF-1.4'], name, { type: 'application/pdf' });
