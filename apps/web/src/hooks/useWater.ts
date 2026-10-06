import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  WaterMeter,
  WaterReading,
  CreateWaterMeterInput,
  UpdateWaterMeterInput,
  CreateWaterReadingInput,
  WaterQueryParams,
  UtilityAnalyticsQueryParams,
  UtilityConsumption,
  ApiListResponse,
  ApiSingleResponse,
} from '../types';

export const waterKeys = {
  all: ['water'] as const,
  meters: () => ['water', 'meters'] as const,
  meterList: (params: WaterQueryParams) => ['water', 'meters', 'list', params] as const,
  meterDetails: () => ['water', 'meters', 'detail'] as const,
  meterDetail: (id: string) => ['water', 'meters', 'detail', id] as const,
  readings: (meterId: string) => ['water', 'meters', meterId, 'readings'] as const,
  analytics: (params: UtilityAnalyticsQueryParams) => ['water', 'analytics', params] as const,
};

export function useWaterMeters(params: WaterQueryParams = {}) {
  return useQuery<ApiListResponse<WaterMeter>>({
    queryKey: waterKeys.meterList(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<WaterMeter>>('/water/meters', {
        params,
      });
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useWaterMeter(id: string) {
  return useQuery<ApiSingleResponse<WaterMeter>>({
    queryKey: waterKeys.meterDetail(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<WaterMeter>>(`/water/meters/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateWaterMeter() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<WaterMeter>, Error, CreateWaterMeterInput>({
    mutationFn: async (input) => {
      const { data } = await api.post<ApiSingleResponse<WaterMeter>>('/water/meters', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: waterKeys.meters() });
    },
  });
}

export function useUpdateWaterMeter(id: string) {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<WaterMeter>, Error, UpdateWaterMeterInput>({
    mutationFn: async (input) => {
      const { data } = await api.patch<ApiSingleResponse<WaterMeter>>(`/water/meters/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: waterKeys.meters() });
      queryClient.invalidateQueries({ queryKey: waterKeys.meterDetail(id) });
    },
  });
}

export function useArchiveWaterMeter() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<WaterMeter>, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.delete<ApiSingleResponse<WaterMeter>>(`/water/meters/${id}`);
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: waterKeys.meters() });
      queryClient.invalidateQueries({ queryKey: waterKeys.meterDetail(id) });
    },
  });
}

export function useWaterReadings(meterId: string, params: { page?: number; limit?: number } = {}) {
  return useQuery<ApiListResponse<WaterReading>>({
    queryKey: waterKeys.readings(meterId),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<WaterReading>>(`/water/meters/${meterId}/readings`, {
        params,
      });
      return data;
    },
    enabled: Boolean(meterId),
  });
}

export function useCreateWaterReading(meterId: string) {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<WaterReading>, Error, CreateWaterReadingInput>({
    mutationFn: async (input) => {
      const { data } = await api.post<ApiSingleResponse<WaterReading>>(`/water/meters/${meterId}/readings`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: waterKeys.readings(meterId) });
      queryClient.invalidateQueries({ queryKey: waterKeys.analytics({}) });
    },
  });
}

export function useWaterAnalytics(params: UtilityAnalyticsQueryParams) {
  return useQuery<{ success: true; data: UtilityConsumption[] }>({
    queryKey: waterKeys.analytics(params),
    queryFn: async () => {
      const { data } = await api.get<{ success: true; data: UtilityConsumption[] }>('/water/analytics', {
        params,
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
