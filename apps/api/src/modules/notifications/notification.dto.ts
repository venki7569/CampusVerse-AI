import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const NOTIFICATION_SEVERITY_FILTER = [
  'INFO',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
  'SUCCESS',
  'WARNING',
] as const;

export const listNotificationsSchema = z.object({
  query: paginationSchema.extend({
    unreadOnly: z
      .string()
      .optional()
      .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
    type: z.string().min(1).max(100).optional(),
    severity: z.enum(NOTIFICATION_SEVERITY_FILTER).optional(),
  }),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>['query'];

export const notificationIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Notification id is required'),
  }),
});

export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>['params'];

export type NotificationDto = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  severity: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type UnreadCountDto = {
  unreadCount: number;
};
