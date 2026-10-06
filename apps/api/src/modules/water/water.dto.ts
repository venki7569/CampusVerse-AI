import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const createWaterMeterSchema = z.object({
  serialNumber: z.string().min(1, 'Serial number is required').max(100).trim(),
  buildingId: z.string().uuid('Invalid building ID').optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export type CreateWaterMeterDto = z.infer<typeof createWaterMeterSchema>;

export const updateWaterMeterSchema = z.object({
  serialNumber: z.string().min(1).max(100).trim().optional(),
  buildingId: z.string().uuid('Invalid building ID').optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdateWaterMeterDto = z.infer<typeof updateWaterMeterSchema>;

export const listWaterMetersSchema = z.object({
  query: paginationSchema.extend({
    buildingId: z.string().uuid().optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  }),
});

export type ListWaterMetersQuery = z.infer<typeof listWaterMetersSchema>['query'];

export const createWaterReadingSchema = z.object({
  litersConsumption: z.number().min(0, 'Consumption must be non-negative'),
  readingTime: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .transform((val) => new Date(val)),
});

export type CreateWaterReadingDto = z.infer<typeof createWaterReadingSchema>;

export const listWaterReadingsSchema = z.object({
  query: paginationSchema.extend({
    from: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
    to: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  }),
});

export type ListWaterReadingsQuery = z.infer<typeof listWaterReadingsSchema>['query'];

export const waterAnalyticsQuerySchema = z.object({
  query: z.object({
    from: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
    to: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
    buildingId: z.string().uuid().optional(),
    meterId: z.string().uuid().optional(),
    groupBy: z.enum(['day', 'week', 'month', 'meter', 'building']).optional().default('day'),
  }),
});

export type WaterAnalyticsQuery = z.infer<typeof waterAnalyticsQuerySchema>['query'];
