import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const OPERATIONAL_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'UNDER_MAINTENANCE',
  'DAMAGED',
  'RETIRED',
] as const;
export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];

export const ASSET_CONDITIONS = [
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'POOR',
  'DAMAGED',
] as const;
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

// ── Create ──────────────────────────────────────────────────────────────────
export const createAssetSchema = z.object({
  assetTag: z
    .string()
    .min(1, 'Asset tag is required')
    .max(50, 'Asset tag must be at most 50 characters')
    .trim(),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim(),
  categoryId: z.string().uuid('Invalid category ID'),
  vendorId: z.string().uuid('Invalid vendor ID').optional().nullable(),
  departmentId: z.string().uuid('Invalid department ID').optional().nullable(),
  buildingId: z.string().uuid('Invalid building ID').optional().nullable(),
  roomId: z.string().uuid('Invalid room ID').optional().nullable(),
  serialNumber: z.string().max(100).trim().optional().nullable(),
  purchaseDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .transform((val) => new Date(val))
    .optional()
    .nullable(),
  purchaseCost: z.number().min(0).optional().nullable(),
  warrantyExpiry: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .transform((val) => new Date(val))
    .optional()
    .nullable(),
  condition: z.enum(ASSET_CONDITIONS).optional().nullable(),
  operationalStatus: z.enum(OPERATIONAL_STATUSES).optional().default('ACTIVE'),
  lastMaintenance: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .transform((val) => new Date(val))
    .optional()
    .nullable(),
  nextMaintenance: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .transform((val) => new Date(val))
    .optional()
    .nullable(),
});

export type CreateAssetDto = z.infer<typeof createAssetSchema>;

// ── Update ──────────────────────────────────────────────────────────────────
export const updateAssetSchema = z.object({
  assetTag: z.string().min(1).max(50).trim().optional(),
  name: z.string().min(2).max(100).trim().optional(),
  categoryId: z.string().uuid('Invalid category ID').optional(),
  vendorId: z.string().uuid('Invalid vendor ID').optional().nullable(),
  departmentId: z.string().uuid('Invalid department ID').optional().nullable(),
  buildingId: z.string().uuid('Invalid building ID').optional().nullable(),
  roomId: z.string().uuid('Invalid room ID').optional().nullable(),
  serialNumber: z.string().max(100).trim().optional().nullable(),
  purchaseDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .transform((val) => new Date(val))
    .optional()
    .nullable(),
  purchaseCost: z.number().min(0).optional().nullable(),
  warrantyExpiry: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .transform((val) => new Date(val))
    .optional()
    .nullable(),
  condition: z.enum(ASSET_CONDITIONS).optional().nullable(),
  operationalStatus: z.enum(OPERATIONAL_STATUSES).optional(),
  lastMaintenance: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .transform((val) => new Date(val))
    .optional()
    .nullable(),
  nextMaintenance: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .transform((val) => new Date(val))
    .optional()
    .nullable(),
});

export type UpdateAssetDto = z.infer<typeof updateAssetSchema>;

// ── List query ────────────────────────────────────────────────────────────
export const listAssetsSchema = z.object({
  query: paginationSchema.extend({
    categoryId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    buildingId: z.string().uuid().optional(),
    roomId: z.string().uuid().optional(),
    condition: z.enum(ASSET_CONDITIONS).optional(),
    operationalStatus: z.enum(OPERATIONAL_STATUSES).optional(),
  }),
});

export type ListAssetsQuery = z.infer<typeof listAssetsSchema>['query'];
