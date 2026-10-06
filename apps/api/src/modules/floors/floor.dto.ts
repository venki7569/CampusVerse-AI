import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const createFloorSchema = z.object({
  level: z.string().min(1, 'Floor level is required').max(20).trim(),
  buildingId: z.string().uuid('Invalid building ID'),
});
export type CreateFloorDto = z.infer<typeof createFloorSchema>;

export const updateFloorSchema = z.object({
  level: z.string().min(1).max(20).trim().optional(),
});
export type UpdateFloorDto = z.infer<typeof updateFloorSchema>;

export const listFloorsSchema = z.object({
  query: paginationSchema.extend({
    buildingId: z.string().uuid().optional(),
  }),
});
export type ListFloorsQuery = z.infer<typeof listFloorsSchema>['query'];
