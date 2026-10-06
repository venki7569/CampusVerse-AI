import { z } from 'zod';
import {
  AnnouncementAudienceType,
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementStatus,
  RoleName,
} from '@prisma/client';
import { paginationSchema } from '../../utils/pagination';

const optionalDate = z
  .string()
  .optional()
  .transform((val) => (val ? new Date(val) : undefined))
  .refine((val) => val === undefined || !Number.isNaN(val.getTime()), {
    message: 'Invalid date',
  });

export const announcementCategorySchema = z.nativeEnum(AnnouncementCategory);
export const announcementPrioritySchema = z.nativeEnum(AnnouncementPriority);
export const announcementStatusSchema = z.nativeEnum(AnnouncementStatus);
export const announcementAudienceTypeSchema = z.nativeEnum(AnnouncementAudienceType);
export const roleNameSchema = z.nativeEnum(RoleName);

export const announcementTargetSchema = z
  .object({
    audienceType: announcementAudienceTypeSchema,
    targetRole: roleNameSchema.optional(),
    targetDepartmentId: z.string().uuid().optional(),
    targetBuildingId: z.string().uuid().optional(),
    targetUserId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.audienceType === 'ROLE' && !data.targetRole) {
      ctx.addIssue({ code: 'custom', message: 'targetRole is required for ROLE audience', path: ['targetRole'] });
    }
    if (data.audienceType === 'DEPARTMENT' && !data.targetDepartmentId) {
      ctx.addIssue({
        code: 'custom',
        message: 'targetDepartmentId is required for DEPARTMENT audience',
        path: ['targetDepartmentId'],
      });
    }
    if (data.audienceType === 'BUILDING' && !data.targetBuildingId) {
      ctx.addIssue({
        code: 'custom',
        message: 'targetBuildingId is required for BUILDING audience',
        path: ['targetBuildingId'],
      });
    }
    if (data.audienceType === 'USER' && !data.targetUserId) {
      ctx.addIssue({
        code: 'custom',
        message: 'targetUserId is required for USER audience',
        path: ['targetUserId'],
      });
    }
  });

export const createAnnouncementSchema = z.object({
  body: z
    .object({
      title: z.string().min(1).max(200).trim(),
      content: z.string().min(1).max(10000).trim(),
      category: announcementCategorySchema.default('GENERAL'),
      priority: announcementPrioritySchema.default('NORMAL'),
      audienceType: announcementAudienceTypeSchema.default('ALL'),
      targetRole: roleNameSchema.optional(),
      targetDepartmentId: z.string().uuid().optional(),
      targetBuildingId: z.string().uuid().optional(),
      targetUserId: z.string().uuid().optional(),
      scheduledAt: optionalDate,
      expiresAt: optionalDate,
    })
    .superRefine((data, ctx) => {
      if (data.expiresAt && data.scheduledAt && data.expiresAt <= data.scheduledAt) {
        ctx.addIssue({ code: 'custom', message: 'expiresAt must be after scheduledAt', path: ['expiresAt'] });
      }
      announcementTargetSchema.parse(data);
    }),
});

export const updateAnnouncementSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      title: z.string().min(1).max(200).trim().optional(),
      content: z.string().min(1).max(10000).trim().optional(),
      category: announcementCategorySchema.optional(),
      priority: announcementPrioritySchema.optional(),
      audienceType: announcementAudienceTypeSchema.optional(),
      targetRole: roleNameSchema.nullable().optional(),
      targetDepartmentId: z.string().uuid().nullable().optional(),
      targetBuildingId: z.string().uuid().nullable().optional(),
      targetUserId: z.string().uuid().nullable().optional(),
      scheduledAt: optionalDate.nullable().optional(),
      expiresAt: optionalDate.nullable().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' }),
});

export const listAnnouncementsSchema = z.object({
  query: paginationSchema.extend({
    search: z.string().optional(),
    status: announcementStatusSchema.optional(),
    category: announcementCategorySchema.optional(),
    priority: announcementPrioritySchema.optional(),
    authorId: z.string().uuid().optional(),
    unreadOnly: z
      .union([z.literal('true'), z.literal('false')])
      .optional()
      .transform((v) => v === 'true'),
    adminView: z
      .union([z.literal('true'), z.literal('false')])
      .optional()
      .transform((v) => v === 'true'),
    from: optionalDate,
    to: optionalDate,
  }),
});

export const announcementIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const scheduleAnnouncementSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    scheduledAt: z
      .string()
      .transform((val) => new Date(val))
      .refine((val) => !Number.isNaN(val.getTime()), { message: 'Invalid scheduledAt' })
      .refine((val) => val.getTime() > Date.now(), { message: 'scheduledAt must be in the future' }),
    expiresAt: optionalDate,
  }),
});

export const publishAnnouncementSchema = announcementIdParamSchema;

export type CreateAnnouncementDto = z.infer<typeof createAnnouncementSchema>['body'];
export type UpdateAnnouncementDto = z.infer<typeof updateAnnouncementSchema>['body'];
export type ListAnnouncementsQuery = {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  status?: z.infer<typeof announcementStatusSchema>;
  category?: z.infer<typeof announcementCategorySchema>;
  priority?: z.infer<typeof announcementPrioritySchema>;
  authorId?: string;
  unreadOnly?: boolean;
  adminView?: boolean;
  from?: Date;
  to?: Date;
};
export type ScheduleAnnouncementDto = z.infer<typeof scheduleAnnouncementSchema>['body'];

export type AnnouncementAuthorDto = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type AnnouncementDto = {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  audienceType: AnnouncementAudienceType;
  targetRole: RoleName | null;
  targetDepartmentId: string | null;
  targetBuildingId: string | null;
  targetUserId: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: AnnouncementAuthorDto;
  targetDepartment?: { id: string; code: string; name: string } | null;
  targetBuilding?: { id: string; code: string; name: string } | null;
  isRead?: boolean;
};

export type AnnouncementFeedSummary = {
  unreadCount: number;
  urgentCount: number;
  latest: AnnouncementDto[];
};
