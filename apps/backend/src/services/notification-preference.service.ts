import { prisma } from '../db/client';
import { Prisma } from '@prisma/client';

export type NotificationChannel = 'inApp' | 'email' | 'push';
export const NOTIFICATION_TYPES = [
  'ISSUE_UPDATE',
  'COMMENT',
  'ANNOUNCEMENT',
  'EVENT',
  'MENTION',
  'ASSIGNMENT',
  'VOTE',
  'SYSTEM',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * B4 — Notification preferences.
 * Per-channel opt-in per notification type. Defaults: everything enabled
 * for inApp, off for email (user must explicitly opt in), off for push.
 */
function defaultPrefs(userId: string): Prisma.NotificationPreferenceCreateManyInput[] {
  const rows: Prisma.NotificationPreferenceCreateManyInput[] = [];
  for (const channel of ['inApp', 'email', 'push'] as const) {
    for (const type of NOTIFICATION_TYPES) {
      rows.push({
        userId,
        channel,
        type,
        enabled: channel === 'inApp',
      });
    }
  }
  return rows;
}

export const notificationPreferenceService = {
  /**
   * Get a user's preferences. If they have none yet, lazily seed the
   * defaults and return them so the UI never sees an empty list.
   */
  async getMine(userId: string) {
    const existing = await prisma.notificationPreference.findMany({
      where: { userId },
      orderBy: [{ channel: 'asc' }, { type: 'asc' }],
    });
    if (existing.length > 0) return existing;

    await prisma.notificationPreference.createMany({ data: defaultPrefs(userId) });
    return prisma.notificationPreference.findMany({
      where: { userId },
      orderBy: [{ channel: 'asc' }, { type: 'asc' }],
    });
  },

  /**
   * Upsert a single (channel, type) preference for the user.
   */
  async set(userId: string, channel: NotificationChannel, type: string, enabled: boolean) {
    return prisma.notificationPreference.upsert({
      where: { userId_channel_type: { userId, channel, type } },
      create: { userId, channel, type, enabled },
      update: { enabled },
    });
  },

  /**
   * Bulk upsert many preferences at once. Used by the Settings page
   * when the user clicks "Save".
   */
  async setMany(
    userId: string,
    prefs: { channel: NotificationChannel; type: string; enabled: boolean }[],
  ) {
    await prisma.$transaction(
      prefs.map(p =>
        prisma.notificationPreference.upsert({
          where: { userId_channel_type: { userId, channel: p.channel, type: p.type } },
          create: { userId, channel: p.channel, type: p.type, enabled: p.enabled },
          update: { enabled: p.enabled },
        }),
      ),
    );
    return this.getMine(userId);
  },

  /**
   * Check whether a user wants a given notification on a given channel.
   * Returns true by default if the row doesn't exist (e.g. for a new
   * notification type that hasn't been seeded yet).
   */
  async isEnabled(userId: string, channel: NotificationChannel, type: string): Promise<boolean> {
    const row = await prisma.notificationPreference.findUnique({
      where: { userId_channel_type: { userId, channel, type } },
    });
    return row ? row.enabled : channel === 'inApp';
  },
};
