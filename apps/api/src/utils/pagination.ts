import { z } from 'zod';
import { config } from '../config/env';

const defaultLimit = config.pagination?.defaultLimit ?? 20;
const maxLimit = config.pagination?.maxLimit ?? 100;

/**
 * Zod schema for common query parameters used in list/search endpoints.
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v): number => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v): number => (v ? parseInt(v, 10) : defaultLimit))
    .pipe(z.number().int().min(1).max(maxLimit)),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  search: z.string().optional(),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

export function getPrismaSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function buildOrderBy(
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
): Record<string, 'asc' | 'desc'> {
  if (!sortBy) return { createdAt: 'desc' };
  return { [sortBy]: sortOrder };
}

export function buildPaginationMeta(total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
