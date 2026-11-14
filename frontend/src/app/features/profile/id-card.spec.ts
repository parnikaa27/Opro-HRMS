import { TestBed } from '@angular/core/testing';
import { employee, text } from '../../../testing/fixtures';
import { IdCard } from './id-card';

describe('IdCard', () => {
  it('puts identity on the front and contact details on the back', async () => {
    const fixture = TestBed.createComponent(IdCard);
    fixture.componentRef.setInput('employee', employee());
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(text(root.querySelector('[data-testid=id-card-front]') as HTMLElement)).toBe(
      'opro Staff ID KP Kasun Perera Site Engineer Operations Employee ID OPR-0018 Blood O-',
    );
    expect(text(root.querySelector('[data-testid=id-card-back]') as HTMLElement)).toBe(
      'Email kasun.perera@opro.mv Phone +960 777 1018 Based at Hulhumalé site Joined 20 December 2023 ' +
        'In an emergency Dilani Perera, spouse +94 77 120 1018 If found, please return to Opro, Malé, Republic of Maldives.',
    );
  });
});
