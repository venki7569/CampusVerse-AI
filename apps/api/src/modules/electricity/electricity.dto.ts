import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const createElectricityMeterSchema = z.object({
  serialNumber: z.string().min(1, 'Serial number is required').max(100).trim(),
  buildingId: z.string().uuid('Invalid building ID').optional().nullable(),
  departmentId: z.string().uuid('Invalid department ID').optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export type CreateElectricityMeterDto = z.infer<typeof createElectricityMeterSchema>;

export const updateElectricityMeterSchema = z.object({
  serialNumber: z.string().min(1).max(100).trim().optional(),
  buildingId: z.string().uuid('Invalid building ID').optional().nullable(),
  departmentId: z.string().uuid('Invalid department ID').optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdateElectricityMeterDto = z.infer<typeof updateElectricityMeterSchema>;

export const listElectricityMetersSchema = z.object({
  query: paginationSchema.extend({
    buildingId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  }),
});

export type ListElectricityMetersQuery = z.infer<typeof listElectricityMetersSchema>['query'];

export const createElectricityReadingSchema = z.object({
  kwhConsumption: z.number().min(0, 'Consumption must be non-negative'),
  readingTime: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .transform((val) => new Date(val)),
});

export type CreateElectricityReadingDto = z.infer<typeof createElectricityReadingSchema>;

export const listElectricityReadingsSchema = z.object({
  query: paginationSchema.extend({
    from: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
    to: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  }),
});

export type ListElectricityReadingsQuery = z.infer<typeof listElectricityReadingsSchema>['query'];

export const electricityAnalyticsQuerySchema = z.object({
  query: z.object({
    from: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
    to: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
    buildingId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    meterId: z.string().uuid().optional(),
    groupBy: z.enum(['day', 'week', 'month', 'meter', 'building', 'department']).optional().default('day'),
  }),
});

export type ElectricityAnalyticsQuery = z.infer<typeof electricityAnalyticsQuerySchema>['query'];
