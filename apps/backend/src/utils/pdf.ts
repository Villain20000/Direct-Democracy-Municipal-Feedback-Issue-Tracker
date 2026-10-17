/**
 * P1-7 — Shared PDF helpers (PLAN feature 23 "Report Export (PDF/CSV)").
 *
 * Every report PDF uses the same branded layout: a coloured header band
 * with the report title + generation metadata, a body, and centred page
 * numbers. Centralising it here keeps `reports.service.ts` to data +
 * content code only.
 */
import PDFDocument from 'pdfkit';

export type PdfDoc = InstanceType<typeof PDFDocument>;

export const PDF_MARGIN = 42;

/** Collect a finished PDFDocument into a Buffer. */
export function buildPdfBuffer(make: (doc: PdfDoc) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: PDF_MARGIN, size: 'A4', bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      make(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export interface BrandHeaderOptions {
  title: string;
  /** Lines rendered under the title (timestamps, filter summaries, counts). */
  lines: string[];
  /** Header band colour. Defaults to brand blue. */
  color?: string;
}

/** Branded header band. Leaves the cursor below the band, ink reset to black. */
export function drawBrandHeader(doc: PdfDoc, opts: BrandHeaderOptions): void {
  const color = opts.color ?? '#2563EB';
  doc.rect(0, 0, doc.page.width, 92).fill(color);
  doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text(opts.title, PDF_MARGIN, 28);
  doc.fontSize(10).font('Helvetica');
  let y = 56;
  for (const line of opts.lines.slice(0, 2)) {
    doc.text(line, PDF_MARGIN, y);
    y += 16;
  }
  doc.fillColor('#000000');
  doc.y = 112;
}

/** UTC generation stamp shared by every report. */
export function generationStamp(): string {
  return `Generated ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

export interface PdfColumn {
  label: string;
  width: number;
}

/** Draw one row of a fixed-width table at the current cursor. */
export function drawTableRow(doc: PdfDoc, columns: PdfColumn[], cells: string[], bold = false): void {
  let x = PDF_MARGIN;
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
  for (let i = 0; i < columns.length; i++) {
    doc
      .fillColor(bold ? '#FFFFFF' : '#111827')
      .text((cells[i] ?? '').slice(0, 60), x + 2, doc.y, {
        width: columns[i].width - 4,
        ellipsis: true,
        lineBreak: false,
      });
    x += columns[i].width;
  }
  doc.fillColor('#000000');
  doc.moveDown(0.35);
}

/** Table header band + one bold header row. */
export function drawTableHeader(doc: PdfDoc, columns: PdfColumn[], color: string): void {
  const total = columns.reduce((s, c) => s + c.width, 0);
  doc.rect(PDF_MARGIN, doc.y, total, 16).fill(color);
  const headerY = doc.y;
  doc.x = PDF_MARGIN;
  doc.y = headerY + 3;
  drawTableRow(doc, columns, columns.map((c) => c.label), true);
}

/** Start a fresh page when the cursor runs low. */
export function ensureRoom(doc: PdfDoc, needed = 80): void {
  if (doc.y > doc.page.height - needed) doc.addPage();
}

/** Section heading used between report parts. */
export function drawSectionTitle(doc: PdfDoc, title: string): void {
  ensureRoom(doc, 100);
  doc.moveDown(0.6);
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#1E293B').text(title);
  doc.moveDown(0.3);
  doc.fillColor('#000000');
}

/** Centred "Page x of y" footer on every buffered page. */
export function addPageNumbers(doc: PdfDoc): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor('#6B7280')
      .text(`Page ${i - range.start + 1} of ${range.count}`, PDF_MARGIN, doc.page.height - 40, {
        width: doc.page.width - PDF_MARGIN * 2,
        align: 'center',
        lineBreak: false,
      });
  }
  doc.fillColor('#000000');
}
