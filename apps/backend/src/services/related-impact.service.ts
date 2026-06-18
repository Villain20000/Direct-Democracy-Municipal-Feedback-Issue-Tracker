import { prisma } from '../db/client';
import { aiService } from '../ai/ollama.service';
import { issueService } from './issue.service';
import { spatialService } from './spatial.service';
import { NotFoundError } from '../errors/domain-errors';

export const relatedImpactService = {
  async analyze(issueId: string) {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        department: { select: { name: true } },
        ward: { select: { name: true } },
      },
    });
    if (!issue) throw new NotFoundError('Issue not found');

    const text = `${issue.title}. ${issue.description}`;
    const [semantic, spatial] = await Promise.all([
      issueService.searchSimilar(text, 6, 0.45).catch(() => ({ data: [] as any[] })),
      issue.latitude != null && issue.longitude != null
        ? spatialService.nearestIssues(Number(issue.latitude), Number(issue.longitude), 5)
        : Promise.resolve([]),
    ]);

    const semanticNeighbors = semantic.data
      .filter((i) => i.id !== issueId)
      .slice(0, 5)
      .map((i) => ({
        id: i.id,
        title: i.title,
        category: i.category,
        status: i.status,
        score: i.score,
        relation: 'semantic' as const,
      }));

    const spatialIds = new Set(semanticNeighbors.map((n) => n.id));
    const spatialNeighbors = spatial
      .filter((n) => n.id !== issueId && !spatialIds.has(n.id))
      .slice(0, 4)
      .map((n) => ({
        id: n.id,
        title: n.title,
        distanceMeters: Math.round(n.distanceMeters),
        relation: 'spatial' as const,
      }));

    const neighborDetails = await prisma.issue.findMany({
      where: { id: { in: [...semanticNeighbors.map((n) => n.id), ...spatialNeighbors.map((n) => n.id)] } },
      select: { id: true, title: true, category: true, status: true },
    });
    const byId = new Map(neighborDetails.map((i) => [i.id, i]));

    const context = [
      `Primary issue: [${issue.category}] ${issue.title} — ${issue.description.slice(0, 200)}`,
      'Semantic neighbors:',
      ...semanticNeighbors.map((n) => {
        const d = byId.get(n.id);
        return `- ${d?.title} (${d?.category}, ${d?.status}, sim=${(n.score || 0).toFixed(2)})`;
      }),
      'Spatial neighbors:',
      ...spatialNeighbors.map((n) => `- ${n.title} (${n.distanceMeters}m away)`),
    ].join('\n');

    const analysis = await aiService.analyzeRelatedImpact({
      title: issue.title,
      category: issue.category,
      department: issue.department?.name,
      ward: issue.ward?.name,
      context,
    });

    return {
      issueId,
      semanticNeighbors,
      spatialNeighbors,
      analysis,
    };
  },
};