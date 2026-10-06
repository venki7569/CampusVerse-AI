import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  Room,
  RoomQueryParams,
  CreateRoomInput,
  UpdateRoomInput,
  UpdateOccupancyInput,
  ApiListResponse,
  ApiSingleResponse,
} from '../types';
import { floorKeys } from './useFloors';
import { buildingKeys } from './useBuildings';
import { dashboardKeys } from './useDashboard';
import { notifyDashboardEvent } from '../services/dashboardEvents';

// ─── Query Key Factory ────────────────────────────────────────────────────────

export const roomKeys = {
  all: ['rooms'] as const,
  lists: () => [...roomKeys.all, 'list'] as const,
  list: (params: RoomQueryParams) => [...roomKeys.lists(), params] as const,
  details: () => [...roomKeys.all, 'detail'] as const,
  detail: (id: string) => [...roomKeys.details(), id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetch a paginated list of rooms with filters (buildingId, floorId, departmentId, roomType, occupancyStatus, operationalStatus, search).
 * GET /api/v1/rooms
 */
export function useRooms(params: RoomQueryParams = {}) {
  return useQuery<ApiListResponse<Room>>({
    queryKey: roomKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<Room>>('/rooms', {
        params,
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a single room by ID (includes floor, building, department, assets, allocations).
 * GET /api/v1/rooms/:id
 */
export function useRoom(id: string) {
  return useQuery<ApiSingleResponse<Room>>({
    queryKey: roomKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<Room>>('/rooms/' + id);
      return data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Create a new room under a floor.
 * POST /api/v1/rooms
 * Requires SUPER_ADMIN, CAMPUS_ADMIN, or DEPARTMENT_ADMIN.
 */
export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation<ApiSingleResponse<Room>, Error, CreateRoomInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ApiSingleResponse<Room>>('/rooms', payload);
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
      queryClient.invalidateQueries({ queryKey: floorKeys.detail(variables.floorId) });
      queryClient.invalidateQueries({ queryKey: floorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: buildingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      if (variables.departmentId) {
        queryClient.invalidateQueries({ queryKey: ['departments'] });
      }
    },
  });
}

/**
 * Update an existing room details.
 * PATCH /api/v1/rooms/:id
 * Requires SUPER_ADMIN, CAMPUS_ADMIN, or DEPARTMENT_ADMIN.
 */
export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiSingleResponse<Room>,
    Error,
    { id: string; data: UpdateRoomInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.patch<ApiSingleResponse<Room>>(
        '/rooms/' + id,
        payload,
      );
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
      queryClient.invalidateQueries({ queryKey: roomKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: floorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      if (variables.data.departmentId !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['departments'] });
      }
    },
  });
}

/**
 * Archive (soft-delete) a room by setting operationalStatus = RETIRED.
 * DELETE /api/v1/rooms/:id
 * Requires SUPER_ADMIN or CAMPUS_ADMIN.
 */
export function useArchiveRoom() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete('/rooms/' + id);
    },
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
      queryClient.invalidateQueries({ queryKey: roomKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: floorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

/**
 * Patch room occupancy through the dedicated occupancy endpoint.
 * PATCH /api/v1/rooms/:id/occupancy
 * Requires SUPER_ADMIN, CAMPUS_ADMIN, DEPARTMENT_ADMIN, or MAINTENANCE_STAFF.
 */
export function useUpdateOccupancy() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiSingleResponse<Room>,
    Error,
    { id: string; data: UpdateOccupancyInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.patch<ApiSingleResponse<Room>>(`/rooms/${id}/occupancy`, payload);
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
      queryClient.invalidateQueries({ queryKey: roomKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      notifyDashboardEvent('room.occupancy.changed');
    },
  });
}
