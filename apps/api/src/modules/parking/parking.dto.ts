import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const PARKING_SLOT_STATUSES = [
  'AVAILABLE',
  'OCCUPIED',
  'RESERVED',
  'UNDER_MAINTENANCE',
] as const;

export const PARKING_SLOT_TYPES = [
  'STANDARD',
  'HANDICAP',
  'EV',
  'MOTORCYCLE',
  'VISITOR',
] as const;

export type ParkingSlotStatus = (typeof PARKING_SLOT_STATUSES)[number];
export type ParkingSlotType = (typeof PARKING_SLOT_TYPES)[number];

const booleanQuery = z
  .string()
  .optional()
  .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined));

export const listParkingAreasSchema = z.object({
  query: paginationSchema.extend({
    buildingId: z.string().uuid().optional(),
    isActive: booleanQuery,
  }),
});

export type ListParkingAreasQuery = z.infer<typeof listParkingAreasSchema>['query'];

export const createParkingSlotSchema = z.object({
  body: z.object({
    areaId: z.string().uuid(),
    slotNumber: z.string().min(1).max(30).trim(),
    slotType: z.enum(PARKING_SLOT_TYPES).optional(),
    status: z.enum(PARKING_SLOT_STATUSES).optional(),
  }),
});

export type CreateParkingSlotDto = z.infer<typeof createParkingSlotSchema>['body'];

export const updateParkingSlotSchema = z.object({
  body: z.object({
    slotNumber: z.string().min(1).max(30).trim().optional(),
    slotType: z.enum(PARKING_SLOT_TYPES).optional(),
    status: z.enum(PARKING_SLOT_STATUSES).optional(),
  }),
});

export type UpdateParkingSlotDto = z.infer<typeof updateParkingSlotSchema>['body'];

export const allocateParkingSlotSchema = z.object({
  body: z.object({
    userId: z.string().uuid('Valid user id is required'),
    status: z.enum(['OCCUPIED', 'RESERVED']).optional(),
  }),
});

export type AllocateParkingSlotDto = z.infer<typeof allocateParkingSlotSchema>['body'];

export const createParkingAreaSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).trim(),
    location: z.string().max(200).trim().optional().nullable(),
    buildingId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export type CreateParkingAreaDto = z.infer<typeof createParkingAreaSchema>['body'];

export const updateParkingAreaSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).trim().optional(),
    location: z.string().max(200).trim().optional().nullable(),
    buildingId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export type UpdateParkingAreaDto = z.infer<typeof updateParkingAreaSchema>['body'];

export const listParkingSlotsSchema = z.object({
  query: paginationSchema.extend({
    areaId: z.string().uuid().optional(),
    buildingId: z.string().uuid().optional(),
    status: z.enum(PARKING_SLOT_STATUSES).optional(),
    slotType: z.enum(PARKING_SLOT_TYPES).optional(),
    reservedForId: z.string().uuid().optional(),
  }),
});

export type ListParkingSlotsQuery = z.infer<typeof listParkingSlotsSchema>['query'];

export const parkingIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid id'),
  }),
});

export const parkingAvailabilityQuerySchema = z.object({
  query: z.object({
    buildingId: z.string().uuid().optional(),
    areaId: z.string().uuid().optional(),
  }),
});

export type ParkingAvailabilityQuery = z.infer<typeof parkingAvailabilityQuerySchema>['query'];

export type ParkingAreaDto = {
  id: string;
  name: string;
  location: string | null;
  buildingId: string | null;
  totalSlots: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  building?: { id: string; code: string; name: string } | null;
  slotCounts?: {
    total: number;
    available: number;
    occupied: number;
    reserved: number;
    underMaintenance: number;
  };
  _count?: { slots: number };
};

export type ParkingSlotDto = {
  id: string;
  areaId: string;
  slotNumber: string;
  slotType: string;
  status: string;
  reservedForId: string | null;
  createdAt: string;
  updatedAt: string;
  area?: {
    id: string;
    name: string;
    location: string | null;
    buildingId: string | null;
    isActive: boolean;
    building?: { id: string; code: string; name: string } | null;
  };
  reservedFor?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
};

export type ParkingAvailabilitySummary = {
  areas: number;
  activeAreas: number;
  totalSlots: number;
  available: number;
  occupied: number;
  reserved: number;
  underMaintenance: number;
  utilizationPercent: number | null;
  byArea: Array<{
    areaId: string;
    name: string;
    isActive: boolean;
    total: number;
    available: number;
    occupied: number;
    reserved: number;
    underMaintenance: number;
    utilizationPercent: number | null;
  }>;
};
