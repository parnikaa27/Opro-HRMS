import { submittedAgo } from './request-row';

describe('submittedAgo', () => {
  it('words today, yesterday and older', () => {
    expect(submittedAgo('2026-11-12', '2026-11-12')).toBe('Submitted today');
    expect(submittedAgo('2026-11-11', '2026-11-12')).toBe('Submitted yesterday');
    expect(submittedAgo('2026-11-02', '2026-11-12')).toBe('Submitted 10 days ago');
  });
});
