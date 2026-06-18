import { prisma } from '../db/client';
import { aiService } from '../ai/ollama.service';
import { spatialService } from './spatial.service';
import { embedText } from './embedding.service';
import { BadRequestError } from '../errors/domain-errors';

type LatLngInput = [number, number];

export interface ClusterGroup {
  label: string;
  category: string;
  count: number;
  issueIds: string[];
  sampleTitles: string[];
  centroid: { lat: number; lng: number } | null;
}

export interface ClusterReport {
  totalIssues: number;
  clusters: ClusterGroup[];
  narrative: string;
  fallback?: boolean;
  mode: 'postgis' | 'memory-fallback';
}

const SIMILARITY_THRESHOLD = 0.62;

export const clusterReportService = {
  async generate(polygonLatLng: LatLngInput[]): Promise<ClusterReport> {
    if (!Array.isArray(polygonLatLng) || polygonLatLng.length < 3) {
      throw new BadRequestError('Polygon must have at least 3 vertices');
    }

    const polygonLngLat: Array<[number, number]> = polygonLatLng.map(([lat, lng]) => [lng, lat]);
    let matched: Array<{ id: string; title: string; status: string; latitude: number; longitude: number }>;
    let mode: ClusterReport['mode'] = 'postgis';

    try {
      matched = await spatialService.issuesInPolygon(polygonLngLat, { limit: 500 });
    } catch (err) {
      console.warn('[cluster-report] PostGIS unavailable:', err);
      mode = 'memory-fallback';
      matched = await memoryBoundingBoxFallback(polygonLatLng);
    }

    if (matched.length === 0) {
      return {
        totalIssues: 0,
        clusters: [],
        narrative: 'No geo-located issues found in the selected area.',
        mode,
      };
    }

    const hydrated = await prisma.issue.findMany({
      where: { id: { in: matched.map((m) => m.id) } },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        latitude: true,
        longitude: true,
      },
    });

    const byCategory = new Map<string, typeof hydrated>();
    for (const issue of hydrated) {
      const list = byCategory.get(issue.category) || [];
      list.push(issue);
      byCategory.set(issue.category, list);
    }

    const clusters: ClusterGroup[] = [];
    for (const [category, issues] of byCategory) {
      if (issues.length < 2) {
        const i = issues[0];
        clusters.push({
          label: `${category} (single)`,
          category,
          count: 1,
          issueIds: [i.id],
          sampleTitles: [i.title],
          centroid: i.latitude != null && i.longitude != null
            ? { lat: Number(i.latitude), lng: Number(i.longitude) }
            : null,
        });
        continue;
      }

      const subclusters = await clusterByEmbedding(issues);
      for (const sc of subclusters) {
        const lats = sc.issues.filter((i) => i.latitude != null).map((i) => Number(i.latitude));
        const lngs = sc.issues.filter((i) => i.longitude != null).map((i) => Number(i.longitude));
        clusters.push({
          label: sc.label,
          category,
          count: sc.issues.length,
          issueIds: sc.issues.map((i) => i.id),
          sampleTitles: sc.issues.slice(0, 3).map((i) => i.title),
          centroid: lats.length && lngs.length
            ? { lat: lats.reduce((a, b) => a + b, 0) / lats.length, lng: lngs.reduce((a, b) => a + b, 0) / lngs.length }
            : null,
        });
      }
    }

    clusters.sort((a, b) => b.count - a.count);

    const clusterText = clusters
      .slice(0, 8)
      .map((c, i) => `${i + 1}. [${c.category}] ${c.label} — ${c.count} issue(s): ${c.sampleTitles.join('; ')}`)
      .join('\n');

    const prompt = `Analyze geographic clusters of ${hydrated.length} citizen issues in a map area.
Identify patterns, possible root causes, and recommended municipal actions.

Clusters:
${clusterText}`;

    try {
      const result = await aiService.summarize(prompt, 300);
      return {
        totalIssues: hydrated.length,
        clusters,
        narrative: result.summary,
        fallback: result.fallback,
        mode,
      };
    } catch {
      return {
        totalIssues: hydrated.length,
        clusters,
        narrative: `Found ${hydrated.length} issues grouped into ${clusters.length} cluster(s). Top category: ${clusters[0]?.category || 'N/A'}.`,
        fallback: true,
        mode,
      };
    }
  },
};

type ClusterIssue = {
  id: string;
  title: string;
  description: string;
  category: string;
  latitude: unknown;
  longitude: unknown;
};

async function clusterByEmbedding(
  issues: ClusterIssue[],
): Promise<Array<{ label: string; issues: ClusterIssue[] }>> {
  const embeddings = new Map<string, number[]>();
  for (const issue of issues.slice(0, 40)) {
    try {
      const text = `${issue.title}. ${issue.description}`;
      embeddings.set(issue.id, await embedText(text));
    } catch {
      // skip embedding failures
    }
  }

  const assigned = new Set<string>();
  const groups: Array<{ label: string; issues: typeof issues }> = [];

  for (const seed of issues) {
    if (assigned.has(seed.id)) continue;
    const seedEmb = embeddings.get(seed.id);
    const group = [seed];
    assigned.add(seed.id);

    if (seedEmb) {
      for (const other of issues) {
        if (assigned.has(other.id)) continue;
        const otherEmb = embeddings.get(other.id);
        if (!otherEmb) continue;
        const sim = cosineSimilarity(seedEmb, otherEmb);
        if (sim >= SIMILARITY_THRESHOLD) {
          group.push(other);
          assigned.add(other.id);
        }
      }
    }

    const label = group.length > 1
      ? `${seed.title.slice(0, 40)}${seed.title.length > 40 ? '…' : ''} (+${group.length - 1})`
      : seed.title.slice(0, 50);
    groups.push({ label, issues: group });
  }

  return groups;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function memoryBoundingBoxFallback(
  polygon: LatLngInput[],
): Promise<Array<{ id: string; title: string; status: string; latitude: number; longitude: number }>> {
  const lats = polygon.map((p) => p[0]);
  const lngs = polygon.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const candidates = await prisma.issue.findMany({
    where: {
      latitude: { not: null, gte: minLat, lte: maxLat },
      longitude: { not: null, gte: minLng, lte: maxLng },
    },
    select: { id: true, title: true, status: true, latitude: true, longitude: true },
  });

  return candidates
    .filter((i) => i.latitude != null && i.longitude != null && pointInPolygon(Number(i.latitude), Number(i.longitude), polygon))
    .map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      latitude: Number(i.latitude),
      longitude: Number(i.longitude),
    }));
}

function pointInPolygon(lat: number, lng: number, polygon: LatLngInput[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}