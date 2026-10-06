import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const ROOM_TYPES = ['CLASSROOM', 'LABORATORY', 'OFFICE', 'SEMINAR_HALL', 'STORAGE', 'OTHER'] as const;
export type RoomType = typeof ROOM_TYPES[number];

export const OCCUPANCY_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'UNDER_MAINTENANCE'] as const;
export type OccupancyStatus = typeof OCCUPANCY_STATUSES[number];

export const OPERATIONAL_STATUSES = ['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'DAMAGED', 'RETIRED'] as const;
export type OperationalStatus = typeof OPERATIONAL_STATUSES[number];

export const createRoomSchema = z.object({
  roomNumber: z.string().min(1).max(20).trim(),
  floorId: z.string().uuid('Invalid floor ID'),
  departmentId: z.string().uuid('Invalid department ID').optional().nullable(),
  capacity: z.number().int().min(0).max(1000).optional().default(0),
  roomType: z.enum(ROOM_TYPES),
  operationalStatus: z.enum(OPERATIONAL_STATUSES).optional().default('ACTIVE'),
  occupancyStatus: z.enum(OCCUPANCY_STATUSES).optional().default('AVAILABLE'),
});
export type CreateRoomDto = z.infer<typeof createRoomSchema>;

export const updateRoomSchema = z.object({
  roomNumber: z.string().min(1).max(20).trim().optional(),
  departmentId: z.string().uuid('Invalid department ID').optional().nullable(),
  capacity: z.number().int().min(0).max(1000).optional(),
  roomType: z.enum(ROOM_TYPES).optional(),
  operationalStatus: z.enum(OPERATIONAL_STATUSES).optional(),
  occupancyStatus: z.enum(OCCUPANCY_STATUSES).optional(),
});
export type UpdateRoomDto = z.infer<typeof updateRoomSchema>;

export const updateOccupancySchema = z.object({
  occupancyStatus: z.enum(OCCUPANCY_STATUSES),
  source: z.enum(['MANUAL', 'SIMULATED', 'IOT_SENSOR']).default('MANUAL'),
  sensorId: z.string().optional(),
  reason: z.string().max(200).optional(),
});
export type UpdateOccupancyDto = z.infer<typeof updateOccupancySchema>;

export const listRoomsSchema = z.object({
  query: paginationSchema.extend({
    floorId: z.string().uuid().optional(),
    buildingId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    roomType: z.enum(ROOM_TYPES).optional(),
    occupancyStatus: z.enum(OCCUPANCY_STATUSES).optional(),
    operationalStatus: z.enum(OPERATIONAL_STATUSES).optional(),
  }),
});
export type ListRoomsQuery = z.infer<typeof listRoomsSchema>['query'];
