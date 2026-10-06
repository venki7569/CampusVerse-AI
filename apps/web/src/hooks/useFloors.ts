import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  Floor,
  FloorQueryParams,
  CreateFloorInput,
  UpdateFloorInput,
  ApiListResponse,
  ApiSingleResponse,
} from '../types';
import { buildingKeys } from './useBuildings';

// ─── Query Key Factory ────────────────────────────────────────────────────────

export const floorKeys = {
  all: ['floors'] as const,
  lists: () => [...floorKeys.all, 'list'] as const,
  list: (params: FloorQueryParams) => [...floorKeys.lists(), params] as const,
  details: () => [...floorKeys.all, 'detail'] as const,
  detail: (id: string) => [...floorKeys.details(), id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetch a paginated list of floors (optionally filtered by buildingId, search, page, limit).
 * GET /api/v1/floors
 */
export function useFloors(params: FloorQueryParams = {}) {
  return useQuery<ApiListResponse<Floor>>({
    queryKey: floorKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<Floor>>('/floors', {
        params,
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a single floor by ID (includes building & rooms).
 * GET /api/v1/floors/:id
 */
export function useFloor(id: string) {
  return useQuery<ApiSingleResponse<Floor>>({
    queryKey: floorKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<Floor>>('/floors/' + id);
      return data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Create a new floor under a building.
 * POST /api/v1/floors
 * Requires SUPER_ADMIN or CAMPUS_ADMIN.
 */
export function useCreateFloor() {
  const queryClient = useQueryClient();

  return useMutation<ApiSingleResponse<Floor>, Error, CreateFloorInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ApiSingleResponse<Floor>>('/floors', payload);
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: floorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: buildingKeys.detail(variables.buildingId) });
      queryClient.invalidateQueries({ queryKey: buildingKeys.lists() });
    },
  });
}

/**
 * Update an existing floor (level name/number).
 * PATCH /api/v1/floors/:id
 * Requires SUPER_ADMIN or CAMPUS_ADMIN.
 */
export function useUpdateFloor() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiSingleResponse<Floor>,
    Error,
    { id: string; data: UpdateFloorInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.patch<ApiSingleResponse<Floor>>(
        '/floors/' + id,
        payload,
      );
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: floorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: floorKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: buildingKeys.lists() });
    },
  });
}

/**
 * Delete a floor.
 * DELETE /api/v1/floors/:id
 * Requires SUPER_ADMIN.
 */
export function useDeleteFloor() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete('/floors/' + id);
    },
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: floorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: floorKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: buildingKeys.lists() });
    },
  });
}
