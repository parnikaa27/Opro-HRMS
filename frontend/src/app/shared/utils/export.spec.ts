import { exportReport, ReportTable } from './export';

const TABLE: ReportTable = { title: 'Headcount', fileName: 'headcount', columns: ['Name', 'Note'], rows: [['Priya Nair', '=SUM(A1)'], ['Karan Mehta', 3]] };

const addRow = vi.fn(() => ({ font: undefined }));
const columns = [{ width: 0 }, { width: 0 }];
vi.mock('exceljs', () => ({
  Workbook: class {
    xlsx = { writeBuffer: async () => new ArrayBuffer(4) };
    addWorksheet = () => ({ addRow, columns });
  },
}));
const pdf = { setFontSize: vi.fn(), text: vi.fn(), save: vi.fn() };
vi.mock('jspdf', () => ({ jsPDF: class { constructor() { return pdf; } } }));
const autoTable = vi.fn();
vi.mock('jspdf-autotable', () => ({ autoTable: (...args: unknown[]) => autoTable(...args) }));

describe('exportReport', () => {
  let saved: string[];

  beforeEach(() => {
    saved = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    URL.createObjectURL = vi.fn(() => 'blob:report');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => vi.restoreAllMocks());

  it('saves CSV with formulas made safe', async () => {
    await exportReport(TABLE, 'csv');

    expect(saved).toEqual(['headcount.csv']);
  });

  it('saves Excel with a bold header and columns sized to their content', async () => {
    await exportReport(TABLE, 'xlsx');

    expect(addRow).toHaveBeenCalledWith(['Name', 'Note']);
    expect(addRow).toHaveBeenCalledWith(['Priya Nair', '=SUM(A1)']);
    expect(columns.map(({ width }) => width)).toEqual([13, 10]);
    expect(saved).toEqual(['headcount.xlsx']);
  });

  it('saves a landscape PDF with a title, the date and the table', async () => {
    await exportReport(TABLE, 'pdf');

    expect(pdf.text).toHaveBeenCalledWith('Headcount', expect.any(Number), expect.any(Number));
    expect(autoTable).toHaveBeenCalledWith(pdf, expect.objectContaining({ head: [['Name', 'Note']], body: [['Priya Nair', '=SUM(A1)'], ['Karan Mehta', '3']] }));
    expect(pdf.save).toHaveBeenCalledWith('headcount.pdf');
  });
});
