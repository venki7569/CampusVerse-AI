import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  ElectricityMeter,
  ElectricityReading,
  CreateElectricityMeterInput,
  UpdateElectricityMeterInput,
  CreateElectricityReadingInput,
  ElectricityQueryParams,
  UtilityAnalyticsQueryParams,
  UtilityConsumption,
  ApiListResponse,
  ApiSingleResponse,
} from '../types';

export const electricityKeys = {
  all: ['electricity'] as const,
  meters: () => ['electricity', 'meters'] as const,
  meterList: (params: ElectricityQueryParams) => ['electricity', 'meters', 'list', params] as const,
  meterDetails: () => ['electricity', 'meters', 'detail'] as const,
  meterDetail: (id: string) => ['electricity', 'meters', 'detail', id] as const,
  readings: (meterId: string) => ['electricity', 'meters', meterId, 'readings'] as const,
  analytics: (params: UtilityAnalyticsQueryParams) => ['electricity', 'analytics', params] as const,
};

export function useElectricityMeters(params: ElectricityQueryParams = {}) {
  return useQuery<ApiListResponse<ElectricityMeter>>({
    queryKey: electricityKeys.meterList(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<ElectricityMeter>>('/electricity/meters', {
        params,
      });
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useElectricityMeter(id: string) {
  return useQuery<ApiSingleResponse<ElectricityMeter>>({
    queryKey: electricityKeys.meterDetail(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<ElectricityMeter>>(`/electricity/meters/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateElectricityMeter() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<ElectricityMeter>, Error, CreateElectricityMeterInput>({
    mutationFn: async (input) => {
      const { data } = await api.post<ApiSingleResponse<ElectricityMeter>>('/electricity/meters', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: electricityKeys.meters() });
    },
  });
}

export function useUpdateElectricityMeter(id: string) {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<ElectricityMeter>, Error, UpdateElectricityMeterInput>({
    mutationFn: async (input) => {
      const { data } = await api.patch<ApiSingleResponse<ElectricityMeter>>(`/electricity/meters/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: electricityKeys.meters() });
      queryClient.invalidateQueries({ queryKey: electricityKeys.meterDetail(id) });
    },
  });
}

export function useArchiveElectricityMeter() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<ElectricityMeter>, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.delete<ApiSingleResponse<ElectricityMeter>>(`/electricity/meters/${id}`);
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: electricityKeys.meters() });
      queryClient.invalidateQueries({ queryKey: electricityKeys.meterDetail(id) });
    },
  });
}

export function useElectricityReadings(meterId: string, params: { page?: number; limit?: number } = {}) {
  return useQuery<ApiListResponse<ElectricityReading>>({
    queryKey: electricityKeys.readings(meterId),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<ElectricityReading>>(`/electricity/meters/${meterId}/readings`, {
        params,
      });
      return data;
    },
    enabled: Boolean(meterId),
  });
}

export function useCreateElectricityReading(meterId: string) {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<ElectricityReading>, Error, CreateElectricityReadingInput>({
    mutationFn: async (input) => {
      const { data } = await api.post<ApiSingleResponse<ElectricityReading>>(`/electricity/meters/${meterId}/readings`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: electricityKeys.readings(meterId) });
      queryClient.invalidateQueries({ queryKey: electricityKeys.analytics({}) });
    },
  });
}

export function useElectricityAnalytics(params: UtilityAnalyticsQueryParams) {
  return useQuery<{ success: true; data: UtilityConsumption[] }>({
    queryKey: electricityKeys.analytics(params),
    queryFn: async () => {
      const { data } = await api.get<{ success: true; data: UtilityConsumption[] }>('/electricity/analytics', {
        params,
      });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
