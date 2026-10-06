import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  Building,
  BuildingQueryParams,
  CreateBuildingInput,
  UpdateBuildingInput,
  ApiListResponse,
  ApiSingleResponse,
} from '../types';

export const buildingKeys = {
  all: ['buildings'] as const,
  lists: () => ['buildings', 'list'] as const,
  list: (params: BuildingQueryParams) => ['buildings', 'list', params] as const,
  details: () => ['buildings', 'detail'] as const,
  detail: (id: string) => ['buildings', 'detail', id] as const,
};

export function useBuildings(params: BuildingQueryParams = {}) {
  return useQuery<ApiListResponse<Building>>({
    queryKey: buildingKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<Building>>('/buildings', {
        params,
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useBuilding(id: string) {
  return useQuery<ApiSingleResponse<Building>>({
    queryKey: buildingKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<Building>>('/buildings/' + id);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateBuilding() {
  const queryClient = useQueryClient();

  return useMutation<ApiSingleResponse<Building>, Error, CreateBuildingInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ApiSingleResponse<Building>>('/buildings', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: buildingKeys.lists() });
    },
  });
}

export function useUpdateBuilding() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiSingleResponse<Building>,
    Error,
    { id: string; data: UpdateBuildingInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.patch<ApiSingleResponse<Building>>(
        '/buildings/' + id,
        payload,
      );
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: buildingKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: buildingKeys.detail(variables.id),
      });
    },
  });
}

export function useArchiveBuilding() {
  const queryClient = useQueryClient();

  return useMutation<ApiSingleResponse<Building>, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.delete<ApiSingleResponse<Building>>('/buildings/' + id);
      return data;
    },
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: buildingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: buildingKeys.detail(id) });
    },
  });
}
