import { TestBed } from '@angular/core/testing';
import { click, fill, text } from '../../../testing/fixtures';
import { DecisionControls } from './decision-controls';
import { Decision } from './team-api';

describe('DecisionControls', () => {
  const render = async (inputs: { isBusy?: boolean; hasFailed?: boolean } = {}) => {
    const fixture = TestBed.createComponent(DecisionControls);
    fixture.componentRef.setInput('requestId', 'LR-1');
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    const decisions: Decision[] = [];
    fixture.componentInstance.decided.subscribe((decision) => decisions.push(decision));
    await fixture.whenStable();
    return { root: fixture.nativeElement as HTMLElement, decisions };
  };

  it('approves in one click', async () => {
    const { root, decisions } = await render();

    click(root, 'approve');

    expect(decisions).toEqual([{ decision: 'approved' }]);
  });

  it('needs a reason before saying no, and sends it trimmed', async () => {
    const { root, decisions } = await render();

    click(root, 'reject');
    click(root, 'confirm-reject');
    expect(text(root.querySelector('.field-error') as HTMLElement)).toBe('Give a short reason so they can plan around it.');
    expect(decisions).toEqual([]);

    fill(root, 'decision-note', '  Audit week  ');
    click(root, 'confirm-reject');
    expect(decisions).toEqual([{ decision: 'rejected', note: 'Audit week' }]);
  });

  it('can back out of saying no', async () => {
    const { root } = await render();

    click(root, 'reject');
    ([...root.querySelectorAll('button')].find((button) => text(button) === 'Back') as HTMLButtonElement).click();
    await Promise.resolve();
    TestBed.tick();

    expect(root.querySelector('[data-testid=approve]')).not.toBeNull();
  });

  it('shows saving and failure states', async () => {
    const { root } = await render({ isBusy: true, hasFailed: true });

    expect((root.querySelector('[data-testid=approve]') as HTMLButtonElement).disabled).toBe(true);
    expect(text(root.querySelector('[data-testid=approve]') as HTMLElement)).toBe('Saving…');
    expect(root.querySelector('[role=alert]')).not.toBeNull();
  });
});
