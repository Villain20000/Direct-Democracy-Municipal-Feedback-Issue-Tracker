/**
 * Map an issue status to a (fill, stroke) color pair for use as a
 * Leaflet circleMarker. Kept as a pure function so it can be unit-tested
 * without bootstrapping Angular, and so other components (heatmap,
 * list-view badges, analytics charts) can reuse the same palette.
 *
 * Color choices follow the traffic-light convention:
 *   - Red   (open states) — needs attention
 *   - Amber (in progress)  — being worked on
 *   - Green (resolved)     — done
 *   - Slate (rejected)     — not actionable
 */
export interface StatusColors {
  fill: string;
  stroke: string;
}

export function statusColors(status: string | null | undefined): StatusColors {
  switch (status) {
    case 'IN_PROGRESS':
      return { fill: '#F59E0B', stroke: '#B45309' };
    case 'RESOLVED':
    case 'VERIFIED':
      return { fill: '#10B981', stroke: '#047857' };
    case 'REJECTED':
      return { fill: '#64748B', stroke: '#334155' };
    case 'SUBMITTED':
    case 'ACKNOWLEDGED':
    case 'PENDING_REVIEW':
    case 'REOPENED':
      return { fill: '#DC2626', stroke: '#991B1B' };
    default:
      // Unknown / null / undefined — fall back to the open color so we
      // never render an invisible (transparent) pin.
      return { fill: '#DC2626', stroke: '#991B1B' };
  }
}
