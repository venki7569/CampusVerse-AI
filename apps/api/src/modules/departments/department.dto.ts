import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

// ── Create ────────────────────────────────────────────────────────────────
export const createDepartmentSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(20, 'Code must be at most 20 characters')
    .toUpperCase()
    .trim(),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  headName: z.string().max(100).trim().optional().nullable(),
  contactInfo: z.string().max(200).trim().optional().nullable(),
});

export type CreateDepartmentDto = z.infer<typeof createDepartmentSchema>;

// ── Update ────────────────────────────────────────────────────────────────
export const updateDepartmentSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  headName: z.string().max(100).trim().optional().nullable(),
  contactInfo: z.string().max(200).trim().optional().nullable(),
});

export type UpdateDepartmentDto = z.infer<typeof updateDepartmentSchema>;

// ── List query ────────────────────────────────────────────────────────────
export const listDepartmentsSchema = z.object({
  query: paginationSchema,
});

export type ListDepartmentsQuery = z.infer<typeof listDepartmentsSchema>['query'];
