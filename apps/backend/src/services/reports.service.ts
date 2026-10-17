import PDFDocument from 'pdfkit';
import { prisma } from '../db/client';
import { NotFoundError } from '../errors/domain-errors';
import {
  addPageNumbers,
  buildPdfBuffer,
  drawBrandHeader,
  drawSectionTitle,
  drawTableHeader,
  drawTableRow,
  ensureRoom,
  generationStamp,
} from '../utils/pdf';

function escapeCsv(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const reportsService = {
  async exportIssuesCsv(filters?: { status?: string; departmentId?: string; wardId?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.wardId) where.wardId = filters.wardId;

    const issues = await prisma.issue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { email: true, firstName: true, lastName: true } },
        department: { select: { name: true, code: true } },
        ward: { select: { name: true, code: true } },
      },
    });

    const headers = ['id', 'title', 'category', 'status', 'priority', 'location', 'reporter', 'department', 'ward', 'upvotes', 'createdAt', 'resolvedAt'];
    const rows = issues.map(i => [
      i.id, i.title, i.category, i.status, i.priority ?? '',
      i.location,
      i.reporter ? `${i.reporter.firstName} ${i.reporter.lastName} <${i.reporter.email}>` : '',
      i.department?.name ?? '', i.ward?.name ?? '',
      i.upvotes, i.createdAt.toISOString(), i.resolvedAt?.toISOString() ?? '',
    ].map(escapeCsv).join(','));

    return [headers.join(','), ...rows].join('\n');
  },

  async exportAuditCsv(filters?: { userId?: string; entity?: string; action?: string }) {
    const where: any = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.entity) where.entity = filters.entity;
    if (filters?.action) where.action = filters.action;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    });

    const headers = ['id', 'timestamp', 'user', 'action', 'entity', 'entityId', 'ipAddress'];
    const rows = logs.map(l => [
      l.id, l.createdAt.toISOString(),
      l.user ? `${l.user.firstName} ${l.user.lastName} <${l.user.email}>` : l.userId,
      l.action, l.entity, l.entityId, l.ipAddress ?? '',
    ].map(escapeCsv).join(','));

    return [headers.join(','), ...rows].join('\n');
  },

  // -----------------------------------------------------------------
  // P1-7 — PDF exports (PLAN feature 23 "Report Export (PDF/CSV)")
  // -----------------------------------------------------------------

  /**
   * Branded issues report PDF: header, filter summary, KPI strip, and
   * a paged table of the filtered issues.
   *
   * Returns a Buffer (the route streams it as application/pdf).
   */
  async exportIssuesPdf(filters?: { status?: string; departmentId?: string; wardId?: string }): Promise<Buffer> {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.wardId) where.wardId = filters.wardId;

    const issues = await prisma.issue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        department: { select: { name: true } },
        ward: { select: { name: true } },
      },
    });
    const total = issues.length;
    const resolved = issues.filter((i) => i.status === 'RESOLVED' || i.status === 'VERIFIED').length;
    const open = total - resolved;

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 42, size: 'A4', bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Branded header
        doc.rect(0, 0, doc.page.width, 92).fill('#2563EB');
        doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold')
          .text('Direct Democracy — Issues Report', 42, 28);
        doc.fontSize(10).font('Helvetica')
          .text(`Generated ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`, 42, 56)
          .text(
            `Filters: status=${filters?.status || 'any'} · department=${filters?.departmentId || 'any'} · ward=${filters?.wardId || 'any'}`,
            42, 72,
          );
        doc.fillColor('#000000');
        doc.y = 112;

        // KPI strip
        doc.fontSize(11).font('Helvetica-Bold')
          .text(`Total: ${total}    Open: ${open}    Resolved: ${resolved}`, { continued: false });
        doc.moveDown(0.8);

        // Table header
        const cols = [
          { label: 'Title', width: 200 },
          { label: 'Category', width: 88 },
          { label: 'Status', width: 84 },
          { label: 'Priority', width: 48 },
          { label: 'Department', width: 90 },
        ];
        const drawRow = (cells: string[], bold = false) => {
          const x0 = 42;
          let x = x0;
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
          for (let i = 0; i < cols.length; i++) {
            const text = (cells[i] ?? '').slice(0, 60);
            doc.fillColor(bold ? '#FFFFFF' : '#111827')
              .text(text, x + 2, doc.y, { width: cols[i].width - 4, ellipsis: true, lineBreak: false });
            x += cols[i].width;
          }
          doc.fillColor('#000000');
          doc.moveDown(0.35);
        };

        doc.rect(42, doc.y, cols.reduce((s, c) => s + c.width, 0), 16).fill('#1E3A8A');
        const headerY = doc.y;
        doc.x = 42; doc.y = headerY + 3;
        drawRow(cols.map((c) => c.label), true);
        doc.rect(42, headerY, cols.reduce((s, c) => s + c.width, 0), 16).fillOpacity(0).stroke();
        doc.fillOpacity(1);

        for (const issue of issues) {
          if (doc.y > doc.page.height - 80) {
            doc.addPage();
          }
          drawRow([
            issue.title,
            issue.category,
            issue.status,
            issue.priority != null ? String(issue.priority) : '—',
            issue.department?.name ?? '—',
          ]);
        }

        // Footer page numbers (bufferPages makes these possible)
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.fontSize(8).fillColor('#6B7280')
            .text(`Page ${i - range.start + 1} of ${range.count}`, 42, doc.page.height - 40, {
              width: doc.page.width - 84, align: 'center', lineBreak: false,
            });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  },

  /** Audit trail PDF — same branded layout, log-focused columns. */
  async exportAuditPdf(filters?: { userId?: string; entity?: string; action?: string }): Promise<Buffer> {
    const where: any = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.entity) where.entity = filters.entity;
    if (filters?.action) where.action = filters.action;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    });

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 42, size: 'A4', bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.rect(0, 0, doc.page.width, 92).fill('#475569');
        doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold')
          .text('Direct Democracy — Audit Trail', 42, 28);
        doc.fontSize(10).font('Helvetica')
          .text(`Generated ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC · ${logs.length} entries`, 42, 56)
          .text(
            `Filters: user=${filters?.userId || 'any'} · entity=${filters?.entity || 'any'} · action=${filters?.action || 'any'}`,
            42, 72,
          );
        doc.fillColor('#000000');
        doc.y = 112;

        const cols = [
          { label: 'Timestamp', width: 130 },
          { label: 'User', width: 150 },
          { label: 'Action', width: 90 },
          { label: 'Entity', width: 90 },
          { label: 'Entity ID', width: 60 },
        ];
        const drawRow = (cells: string[], bold = false) => {
          let x = 42;
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
          for (let i = 0; i < cols.length; i++) {
            doc.fillColor(bold ? '#FFFFFF' : '#111827')
              .text((cells[i] ?? '').slice(0, 55), x + 2, doc.y, { width: cols[i].width - 4, ellipsis: true, lineBreak: false });
            x += cols[i].width;
          }
          doc.fillColor('#000000');
          doc.moveDown(0.35);
        };

        doc.rect(42, doc.y, cols.reduce((s, c) => s + c.width, 0), 16).fill('#334155');
        const headerY = doc.y;
        doc.x = 42; doc.y = headerY + 3;
        drawRow(cols.map((c) => c.label), true);

        for (const log of logs) {
          if (doc.y > doc.page.height - 80) doc.addPage();
          drawRow([
            log.createdAt.toISOString().slice(0, 19).replace('T', ' '),
            log.user ? `${log.user.firstName} ${log.user.lastName}` : log.userId,
            log.action,
            log.entity,
            log.entityId.slice(0, 8),
          ]);
        }

        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.fontSize(8).fillColor('#6B7280')
            .text(`Page ${i - range.start + 1} of ${range.count}`, 42, doc.page.height - 40, {
              width: doc.page.width - 84, align: 'center', lineBreak: false,
            });
        }
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  },

  /**
   * Weekly executive briefing PDF — renders the latest stored
   * WeeklySummary row (or the row for `weekKey`): week range, KPI
   * strip, category/department breakdowns, the prose body, and the
   * highlight cards. Throws NotFoundError when no briefing exists yet.
   */
  async exportBriefingPdf(weekKey?: string): Promise<Buffer> {
    const row = weekKey
      ? await prisma.weeklySummary.findUnique({ where: { weekKey } })
      : await prisma.weeklySummary.findFirst({ orderBy: { weekStart: 'desc' } });
    if (!row) throw new NotFoundError('No weekly briefing available yet');

    const stats = (row.stats ?? {}) as Record<string, any>;
    const highlights = (Array.isArray(row.highlights) ? row.highlights : []) as Array<{
      title?: string;
      body?: string;
    }>;
    const byCategory = (stats.byCategory ?? {}) as Record<string, number>;
    const byDepartment = (stats.byDepartment ?? {}) as Record<string, number>;

    return buildPdfBuffer((doc) => {
      drawBrandHeader(doc, {
        title: 'Direct Democracy — Weekly Briefing',
        lines: [
          `${generationStamp()} · Week ${row.weekKey} (${row.weekStart.toISOString().slice(0, 10)} → ${row.weekEnd.toISOString().slice(0, 10)})`,
          `Source: ${row.source}`,
        ],
        color: '#0F766E',
      });

      doc.fontSize(11).font('Helvetica-Bold').text(
        `New: ${stats.newCount ?? 0}    Resolved: ${stats.resolvedCount ?? 0}    Avg resolution: ${stats.averageResolutionDays ?? '—'} days`,
      );
      doc.moveDown(0.8);

      drawSectionTitle(doc, 'Issues by category');
      const cols = [
        { label: 'Category', width: 260 },
        { label: 'Count', width: 120 },
      ];
      drawTableHeader(doc, cols, '#0F766E');
      const catEntries = Object.entries(byCategory);
      if (!catEntries.length) {
        ensureRoom(doc);
        doc.fontSize(9).font('Helvetica').fillColor('#6B7280').text('No new issues this week.');
        doc.fillColor('#000000');
      }
      for (const [cat, count] of catEntries) {
        ensureRoom(doc);
        drawTableRow(doc, cols, [cat, String(count)]);
      }

      drawSectionTitle(doc, 'Issues by department');
      drawTableHeader(doc, cols, '#0F766E');
      const deptEntries = Object.entries(byDepartment);
      if (!deptEntries.length) {
        ensureRoom(doc);
        doc.fontSize(9).font('Helvetica').fillColor('#6B7280').text('No department attributions this week.');
        doc.fillColor('#000000');
      }
      for (const [dept, count] of deptEntries) {
        ensureRoom(doc);
        drawTableRow(doc, cols, [dept, String(count)]);
      }

      drawSectionTitle(doc, 'Executive summary');
      ensureRoom(doc, 120);
      doc.fontSize(10).font('Helvetica').fillColor('#111827').text(row.body, { width: doc.page.width - 84 });
      doc.fillColor('#000000');

      if (highlights.length) {
        drawSectionTitle(doc, 'Highlights');
        for (const h of highlights) {
          ensureRoom(doc, 100);
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text(`• ${h.title ?? 'Highlight'}`);
          if (h.body) doc.fontSize(9).font('Helvetica').fillColor('#374151').text(h.body, { width: doc.page.width - 84 });
          doc.fillColor('#000000');
          doc.moveDown(0.3);
        }
      }

      addPageNumbers(doc);
    });
  },

  /**
   * Resolution dossier PDF for a single issue: identity block, status
   * timeline, comments, and the audit trail for the issue entity.
   * Throws NotFoundError for an unknown issue id.
   */
  async exportDossierPdf(issueId: string): Promise<Buffer> {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        reporter: { select: { email: true, firstName: true, lastName: true } },
        assignee: { select: { email: true, firstName: true, lastName: true } },
        department: { select: { name: true, code: true } },
        ward: { select: { name: true, code: true } },
      },
    });
    if (!issue) throw new NotFoundError('Issue not found');

    const [comments, history, trail] = await Promise.all([
      prisma.comment.findMany({
        where: { issueId },
        orderBy: { createdAt: 'asc' },
        take: 200,
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
      prisma.statusHistory.findMany({
        where: { issueId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.auditLog.findMany({
        where: { entity: 'Issue', entityId: issueId },
        orderBy: { createdAt: 'asc' },
        take: 200,
      }),
    ]);

    return buildPdfBuffer((doc) => {
      drawBrandHeader(doc, {
        title: 'Direct Democracy — Resolution Dossier',
        lines: [
          generationStamp(),
          `Issue ${issue.id.slice(0, 8)} · ${issue.status} · ${issue.category}`,
        ],
        color: '#7C3AED',
      });

      doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827')
        .text(issue.title, { width: doc.page.width - 84 });
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').fillColor('#374151')
        .text(issue.description, { width: doc.page.width - 84 });
      doc.fillColor('#000000');
      doc.moveDown(0.5);

      const meta: Array<[string, string]> = [
        ['Status', issue.status],
        ['Category', issue.category],
        ['Priority', issue.priority != null ? String(issue.priority) : '—'],
        ['Location', issue.location],
        ['Reporter', issue.reporter ? `${issue.reporter.firstName} ${issue.reporter.lastName} <${issue.reporter.email}>` : '—'],
        ['Assignee', issue.assignee ? `${issue.assignee.firstName} ${issue.assignee.lastName}` : 'Unassigned'],
        ['Department', issue.department ? `${issue.department.name} (${issue.department.code})` : '—'],
        ['Ward', issue.ward ? `${issue.ward.name} (${issue.ward.code})` : '—'],
        ['Upvotes', String(issue.upvotes)],
        ['Created', issue.createdAt.toISOString().slice(0, 19).replace('T', ' ')],
        ['Resolved', issue.resolvedAt ? issue.resolvedAt.toISOString().slice(0, 19).replace('T', ' ') : '—'],
      ];
      const metaCols = [
        { label: 'Field', width: 140 },
        { label: 'Value', width: 380 },
      ];
      drawTableHeader(doc, metaCols, '#7C3AED');
      for (const [k, v] of meta) {
        ensureRoom(doc);
        drawTableRow(doc, metaCols, [k, v]);
      }

      drawSectionTitle(doc, `Status timeline (${history.length})`);
      if (!history.length) {
        doc.fontSize(9).font('Helvetica').fillColor('#6B7280').text('No status changes recorded.');
        doc.fillColor('#000000');
      }
      for (const h of history) {
        ensureRoom(doc, 100);
        doc.fontSize(9).font('Helvetica').fillColor('#111827')
          .text(`${h.createdAt.toISOString().slice(0, 19).replace('T', ' ')} — ${h.oldStatus ?? '∅'} → ${h.newStatus}${h.note ? ` — ${h.note}` : ''}`, { width: doc.page.width - 84 });
        doc.fillColor('#000000');
      }

      drawSectionTitle(doc, `Comments (${comments.length})`);
      if (!comments.length) {
        doc.fontSize(9).font('Helvetica').fillColor('#6B7280').text('No comments yet.');
        doc.fillColor('#000000');
      }
      for (const c of comments) {
        ensureRoom(doc, 100);
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827')
          .text(`${c.user ? `${c.user.firstName} ${c.user.lastName}` : c.userId} · ${c.createdAt.toISOString().slice(0, 19).replace('T', ' ')}`);
        doc.fontSize(9).font('Helvetica').fillColor('#374151').text(c.content, { width: doc.page.width - 84 });
        doc.fillColor('#000000');
        doc.moveDown(0.3);
      }

      drawSectionTitle(doc, `Audit trail (${trail.length})`);
      if (!trail.length) {
        doc.fontSize(9).font('Helvetica').fillColor('#6B7280').text('No audit entries for this issue.');
        doc.fillColor('#000000');
      }
      const trailCols = [
        { label: 'Timestamp', width: 130 },
        { label: 'Action', width: 150 },
        { label: 'Actor', width: 240 },
      ];
      if (trail.length) drawTableHeader(doc, trailCols, '#7C3AED');
      for (const t of trail) {
        ensureRoom(doc);
        drawTableRow(doc, trailCols, [
          t.createdAt.toISOString().slice(0, 19).replace('T', ' '),
          t.action,
          t.userId.slice(0, 8),
        ]);
      }

      addPageNumbers(doc);
    });
  },
};