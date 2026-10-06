import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const MAINTENANCE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type MaintenancePriority = (typeof MAINTENANCE_PRIORITIES)[number];

export const MAINTENANCE_STATUSES = [
  'REPORTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
  'CANCELLED',
] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_CATEGORIES = [
  'ELECTRICAL',
  'PLUMBING',
  'HVAC',
  'NETWORK',
  'IT_EQUIPMENT',
  'FURNITURE',
  'CLEANING',
  'CIVIL',
  'SAFETY',
  'OTHER',
] as const;
export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number];

// ── Create ──────────────────────────────────────────────────────────────────
export const createMaintenanceRequestSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be at most 100 characters')
    .trim(),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must be at most 2000 characters')
    .trim(),
  categoryId: z.enum(MAINTENANCE_CATEGORIES).optional().nullable(),
  priority: z.enum(MAINTENANCE_PRIORITIES).optional().default('MEDIUM'),
  buildingId: z.string().uuid('Invalid building ID').optional().nullable(),
  roomId: z.string().uuid('Invalid room ID').optional().nullable(),
  assetId: z.string().uuid('Invalid asset ID').optional().nullable(),
  images: z.array(z.string().url('Invalid image URL')).max(5, 'Maximum 5 images allowed').optional().default([]),
});

export type CreateMaintenanceRequestDto = z.infer<typeof createMaintenanceRequestSchema>;

// ── Update ──────────────────────────────────────────────────────────────────
export const updateMaintenanceRequestSchema = z.object({
  title: z.string().min(3).max(100).trim().optional(),
  description: z.string().min(10).max(2000).trim().optional(),
  categoryId: z.enum(MAINTENANCE_CATEGORIES).optional().nullable(),
  priority: z.enum(MAINTENANCE_PRIORITIES).optional(),
  buildingId: z.string().uuid().optional().nullable(),
  roomId: z.string().uuid().optional().nullable(),
  assetId: z.string().uuid().optional().nullable(),
  images: z.array(z.string().url()).max(5).optional(),
});

export type UpdateMaintenanceRequestDto = z.infer<typeof updateMaintenanceRequestSchema>;

// ── Assign Technician ───────────────────────────────────────────────────────
export const assignMaintenanceRequestSchema = z.object({
  technicianId: z.string().uuid('Invalid technician User ID'),
});

export type AssignMaintenanceRequestDto = z.infer<typeof assignMaintenanceRequestSchema>;

// ── Resolve Request ─────────────────────────────────────────────────────────
export const resolveMaintenanceRequestSchema = z.object({
  resolutionNotes: z
    .string()
    .min(5, 'Resolution notes must be at least 5 characters')
    .max(2000, 'Resolution notes must be at most 2000 characters')
    .trim(),
  cost: z.number().min(0).optional().nullable(),
});

export type ResolveMaintenanceRequestDto = z.infer<typeof resolveMaintenanceRequestSchema>;

// ── Close / Reject / Cancel Request ─────────────────────────────────────────
export const closeMaintenanceRequestSchema = z.object({
  notes: z.string().max(1000).trim().optional(),
});

export type CloseMaintenanceRequestDto = z.infer<typeof closeMaintenanceRequestSchema>;

export const cancelOrRejectMaintenanceRequestSchema = z.object({
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500).trim(),
});

export type CancelOrRejectMaintenanceRequestDto = z.infer<typeof cancelOrRejectMaintenanceRequestSchema>;

// ── Add Comment ─────────────────────────────────────────────────────────────
export const createMaintenanceCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(1000).trim(),
});

export type CreateMaintenanceCommentDto = z.infer<typeof createMaintenanceCommentSchema>;

// ── List Query ──────────────────────────────────────────────────────────────
export const listMaintenanceRequestsSchema = z.object({
  query: paginationSchema.extend({
    status: z.enum(MAINTENANCE_STATUSES).optional(),
    priority: z.enum(MAINTENANCE_PRIORITIES).optional(),
    categoryId: z.enum(MAINTENANCE_CATEGORIES).optional(),
    buildingId: z.string().uuid().optional(),
    roomId: z.string().uuid().optional(),
    assetId: z.string().uuid().optional(),
    technicianId: z.string().uuid().optional(),
    reporterId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
  }),
});

export type ListMaintenanceRequestsQuery = z.infer<typeof listMaintenanceRequestsSchema>['query'];
