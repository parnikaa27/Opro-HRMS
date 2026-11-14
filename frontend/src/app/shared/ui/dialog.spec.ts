import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { settle } from '../../../testing/fixtures';
import { Dialog } from './dialog';

@Component({
  imports: [Dialog],
  template: `<app-dialog heading="Apply for leave" [(isOpen)]="isOpen"><p data-testid="content">Form</p></app-dialog>`,
})
class Host {
  readonly isOpen = signal(false);
}

describe('Dialog', () => {
  it('opens as a modal, renders content only while open, and closes from its button', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const dialog = element.querySelector('dialog') as HTMLDialogElement;
    expect(element.querySelector('[data-testid=content]')).toBeNull();

    fixture.componentInstance.isOpen.set(true);
    await settle();
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('aria-label')).toBe('Apply for leave');
    expect(element.querySelector('[data-testid=content]')).not.toBeNull();

    (element.querySelector('dialog header button') as HTMLButtonElement).click();
    await settle();
    expect(dialog.open).toBe(false);
    expect(fixture.componentInstance.isOpen()).toBe(false);
  });

  it('syncs back when the browser closes it, like pressing Escape', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.isOpen.set(true);
    await settle();

    (fixture.nativeElement.querySelector('dialog') as HTMLDialogElement).close();
    await settle();

    expect(fixture.componentInstance.isOpen()).toBe(false);
  });
});
