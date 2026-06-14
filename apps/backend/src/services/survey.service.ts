import { prisma } from '../db/client';
import {
  AlreadyClosedError,
  AlreadyRespondedError,
  NotFoundError,
} from '../errors/domain-errors';

export const surveyService = {
  async create(data: {
    title: string; description?: string; creatorId: string;
    closesAt?: string;
    questions: Array<{ text: string; type: string; options?: string[]; order: number }>;
  }) {
    const survey = await prisma.survey.create({
      data: {
        title: data.title,
        description: data.description,
        creatorId: data.creatorId,
        closesAt: data.closesAt ? new Date(data.closesAt) : undefined,
        questions: {
          create: data.questions.map(q => ({
            text: q.text,
            type: q.type,
            options: q.options ? q.options : undefined,
            order: q.order,
          })),
        },
      },
      include: { questions: { orderBy: { order: 'asc' } }, creator: { select: { id: true, firstName: true, lastName: true } } },
    });
    return survey;
  },

  async getAll(params: { page?: number; pageSize?: number; activeOnly?: boolean }) {
    const { page = 1, pageSize = 20, activeOnly } = params;
    const where: any = {};
    if (activeOnly) where.isActive = true;

    const [data, total] = await Promise.all([
      prisma.survey.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          questions: { orderBy: { order: 'asc' } },
          creator: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { responses: true } },
        },
      }),
      prisma.survey.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async getById(id: string) {
    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: 'asc' } },
        creator: { select: { id: true, firstName: true, lastName: true } },
        responses: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { responses: true } },
      },
    });
    if (!survey) throw new NotFoundError('Survey not found');
    return survey;
  },

  async submitResponse(surveyId: string, userId: string, answers: Record<string, unknown>) {
    const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) throw new NotFoundError('Survey not found');
    if (!survey.isActive) throw new AlreadyClosedError('Survey is no longer active');
    if (survey.closesAt && survey.closesAt < new Date()) throw new AlreadyClosedError('Survey has closed');

    const existing = await prisma.surveyResponse.findFirst({
      where: { surveyId, userId },
    });
    if (existing) throw new AlreadyRespondedError('You have already responded to this survey');

    return prisma.surveyResponse.create({
      data: { surveyId, userId, answers: answers as any },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  },

  async close(id: string) {
    return prisma.survey.update({ where: { id }, data: { isActive: false } });
  },

  async delete(id: string) {
    const survey = await prisma.survey.findUnique({ where: { id } });
    if (!survey) throw new NotFoundError('Survey not found');
    return prisma.survey.delete({ where: { id } });
  },
};