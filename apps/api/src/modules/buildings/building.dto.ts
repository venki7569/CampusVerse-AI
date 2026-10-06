import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

// Matches Prisma OperationalStatus enum
export const operationalStatusValues = [
  'ACTIVE',
  'INACTIVE',
  'UNDER_MAINTENANCE',
  'DAMAGED',
  'RETIRED',
] as const;

export type OperationalStatus = (typeof operationalStatusValues)[number];

// ─── Create ───────────────────────────────────────────────────────────────────
export const createBuildingSchema = z.object({
  code: z.string().min(1).max(20).toUpperCase().trim(),
  name: z.string().min(2).max(100).trim(),
  location: z.string().max(200).optional(),
  coordinates: z.string().max(100).optional(),
  operationalStatus: z
    .enum(operationalStatusValues)
    .optional()
    .default('ACTIVE'),
});

export type CreateBuildingDto = z.infer<typeof createBuildingSchema>;

// ─── Update ───────────────────────────────────────────────────────────────────
// campusId is intentionally excluded — buildings are not re-assigned between campuses.
export const updateBuildingSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  location: z.string().max(200).optional(),
  coordinates: z.string().max(100).optional(),
  operationalStatus: z.enum(operationalStatusValues).optional(),
});

export type UpdateBuildingDto = z.infer<typeof updateBuildingSchema>;

// ─── List (query params) ──────────────────────────────────────────────────────
export const listBuildingsSchema = z.object({
  query: paginationSchema,
});

export type ListBuildingsQuery = z.infer<typeof listBuildingsSchema>['query'];
