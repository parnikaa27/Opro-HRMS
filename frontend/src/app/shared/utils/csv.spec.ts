import { downloadCsv, toCsv } from './csv';

describe('CSV export', () => {
  afterEach(() => vi.restoreAllMocks());

  it('quotes every cell, doubles quotes, and stops formulas from running in Excel', () => {
    expect(toCsv([['Name', 'Note'], ['Priya "P" Nair', '=HYPERLINK("x")'], ['-1', 3]])).toBe(
      '"Name","Note"\r\n"Priya ""P"" Nair","\'=HYPERLINK(""x"")"\r\n"\'-1","3"',
    );
  });

  it('downloads through a temporary link', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:file');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadCsv('report.csv', [['a']]);

    expect(clicked).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:file');
  });
});
