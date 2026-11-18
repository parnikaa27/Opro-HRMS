import { downloadCsv } from './csv';
import { formatFullDate, maldivesToday } from './date-time';

// A report ready to save: a title, column names and rows of plain values.
export interface ReportTable {
  title: string;
  fileName: string;
  columns: readonly string[];
  rows: readonly (readonly (string | number)[])[];
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

const EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SHEET_NAME_LENGTH = 31;
const WIDEST_COLUMN = 40;
const TITLE_SIZE = 14;
const NOTE_SIZE = 9;
const MARGIN = 14;
const TITLE_LINE = 16;
const NOTE_LINE = 22;
const TABLE_TOP = 28;
const NAVY = '#102d3f';
const COLUMN_PADDING = 2;

const save = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: fileName }).click();
  URL.revokeObjectURL(url);
};

// Excel keeps every value as plain data: text starting with "=" stays text, never a formula.
const toExcel = async ({ title, fileName, columns, rows }: ReportTable) => {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(title.slice(0, SHEET_NAME_LENGTH));
  sheet.addRow([...columns]).font = { bold: true };
  rows.forEach((row) => sheet.addRow([...row]));
  sheet.columns.forEach((column, index) => {
    const widest = Math.max(columns[index]?.length ?? 0, ...rows.map((row) => String(row[index] ?? '').length));
    column.width = Math.min(widest + COLUMN_PADDING, WIDEST_COLUMN);
  });
  save(new Blob([await workbook.xlsx.writeBuffer()], { type: EXCEL_TYPE }), `${fileName}.xlsx`);
};

const toPdf = async ({ title, fileName, columns, rows }: ReportTable) => {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new jsPDF({ orientation: 'landscape' });
  pdf.setFontSize(TITLE_SIZE);
  pdf.text(title, MARGIN, TITLE_LINE);
  pdf.setFontSize(NOTE_SIZE);
  pdf.text(`Opro HRMS, ${formatFullDate(maldivesToday())}`, MARGIN, NOTE_LINE);
  autoTable(pdf, { head: [[...columns]], body: rows.map((row) => row.map(String)), startY: TABLE_TOP, headStyles: { fillColor: NAVY }, styles: { fontSize: NOTE_SIZE } });
  pdf.save(`${fileName}.pdf`);
};

// The Excel and PDF libraries only load when someone exports.
export const exportReport = (table: ReportTable, format: ExportFormat): Promise<void> | void =>
  format === 'csv' ? downloadCsv(`${table.fileName}.csv`, [table.columns, ...table.rows]) : format === 'xlsx' ? toExcel(table) : toPdf(table);
