import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  Asset,
  AssetCategory,
  Vendor,
  AssetQueryParams,
  CreateAssetInput,
  UpdateAssetInput,
  ApiListResponse,
  ApiSingleResponse,
} from '../types';

export const assetKeys = {
  all: ['assets'] as const,
  lists: () => ['assets', 'list'] as const,
  list: (params: AssetQueryParams) => ['assets', 'list', params] as const,
  details: () => ['assets', 'detail'] as const,
  detail: (id: string) => ['assets', 'detail', id] as const,
  categories: () => ['assets', 'categories'] as const,
  vendors: () => ['assets', 'vendors'] as const,
};

export function useAssets(params: AssetQueryParams = {}) {
  return useQuery<ApiListResponse<Asset>>({
    queryKey: assetKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<Asset>>('/assets', {
        params,
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAsset(id: string) {
  return useQuery<ApiSingleResponse<Asset>>({
    queryKey: assetKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<Asset>>(`/assets/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useAssetCategories() {
  return useQuery<ApiSingleResponse<AssetCategory[]> | { success: true; data: AssetCategory[] }>({
    queryKey: assetKeys.categories(),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<AssetCategory[]>>('/assets/categories');
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useVendors() {
  return useQuery<ApiSingleResponse<Vendor[]> | { success: true; data: Vendor[] }>({
    queryKey: assetKeys.vendors(),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<Vendor[]>>('/assets/vendors');
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation<ApiSingleResponse<Asset>, Error, CreateAssetInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ApiSingleResponse<Asset>>('/assets', payload);
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: assetKeys.lists() });
      if (variables.roomId) {
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
      }
      if (variables.departmentId) {
        queryClient.invalidateQueries({ queryKey: ['departments'] });
      }
      if (variables.buildingId) {
        queryClient.invalidateQueries({ queryKey: ['buildings'] });
      }
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiSingleResponse<Asset>,
    Error,
    { id: string; data: UpdateAssetInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.patch<ApiSingleResponse<Asset>>(`/assets/${id}`, payload);
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: assetKeys.lists() });
      queryClient.invalidateQueries({ queryKey: assetKeys.detail(variables.id) });
      if (variables.data.roomId) {
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
      }
      if (variables.data.departmentId) {
        queryClient.invalidateQueries({ queryKey: ['departments'] });
      }
      if (variables.data.buildingId) {
        queryClient.invalidateQueries({ queryKey: ['buildings'] });
      }
    },
  });
}

export function useArchiveAsset() {
  const queryClient = useQueryClient();

  return useMutation<ApiSingleResponse<Asset>, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.delete<ApiSingleResponse<Asset>>(`/assets/${id}`);
      return data;
    },
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: assetKeys.lists() });
      queryClient.invalidateQueries({ queryKey: assetKeys.detail(id) });
    },
  });
}
