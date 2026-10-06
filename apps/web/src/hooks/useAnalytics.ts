import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  AnalyticsOverview,
  AnalyticsQueryParams,
  AnalyticsReport,
  AnalyticsTrends,
  AssetAnalytics,
  BuildingAnalytics,
  DepartmentAnalytics,
  MaintenanceAnalytics,
  OccupancyAnalytics,
  ParkingAnalyticsData,
  UtilityAnalytics,
  ApiListResponse,
  ApiSingleResponse,
} from '../types';

export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: (params: AnalyticsQueryParams) => [...analyticsKeys.all, 'overview', params] as const,
  trends: (params: AnalyticsQueryParams) => [...analyticsKeys.all, 'trends', params] as const,
  buildings: (params: AnalyticsQueryParams) => [...analyticsKeys.all, 'buildings', params] as const,
  departments: (params: AnalyticsQueryParams) =>
    [...analyticsKeys.all, 'departments', params] as const,
  utilities: (params: AnalyticsQueryParams) => [...analyticsKeys.all, 'utilities', params] as const,
  maintenance: (params: AnalyticsQueryParams) =>
    [...analyticsKeys.all, 'maintenance', params] as const,
  assets: (params: AnalyticsQueryParams) => [...analyticsKeys.all, 'assets', params] as const,
  occupancy: (params: AnalyticsQueryParams) => [...analyticsKeys.all, 'occupancy', params] as const,
  parking: (params: AnalyticsQueryParams) => [...analyticsKeys.all, 'parking', params] as const,
  reports: (params: AnalyticsQueryParams) => [...analyticsKeys.all, 'reports', params] as const,
};

export function useAnalyticsOverview(params: AnalyticsQueryParams = {}) {
  return useQuery<ApiSingleResponse<AnalyticsOverview>>({
    queryKey: analyticsKeys.overview(params),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<AnalyticsOverview>>('/analytics/overview', {
        params,
      });
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useAnalyticsTrends(params: AnalyticsQueryParams = {}) {
  return useQuery<ApiSingleResponse<AnalyticsTrends>>({
    queryKey: analyticsKeys.trends(params),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<AnalyticsTrends>>('/analytics/trends', {
        params,
      });
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useBuildingAnalytics(params: AnalyticsQueryParams = {}) {
  return useQuery<ApiListResponse<BuildingAnalytics>>({
    queryKey: analyticsKeys.buildings(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<BuildingAnalytics>>('/analytics/buildings', {
        params,
      });
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useDepartmentAnalytics(params: AnalyticsQueryParams = {}) {
  return useQuery<ApiListResponse<DepartmentAnalytics>>({
    queryKey: analyticsKeys.departments(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<DepartmentAnalytics>>('/analytics/departments', {
        params,
      });
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useUtilityAnalytics(params: AnalyticsQueryParams = {}) {
  return useQuery<ApiSingleResponse<UtilityAnalytics>>({
    queryKey: analyticsKeys.utilities(params),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<UtilityAnalytics>>('/analytics/utilities', {
        params,
      });
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useMaintenanceAnalytics(params: AnalyticsQueryParams = {}) {
  return useQuery<ApiSingleResponse<MaintenanceAnalytics>>({
    queryKey: analyticsKeys.maintenance(params),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<MaintenanceAnalytics>>('/analytics/maintenance', {
        params,
      });
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useAssetAnalytics(params: AnalyticsQueryParams = {}) {
  return useQuery<ApiSingleResponse<AssetAnalytics>>({
    queryKey: analyticsKeys.assets(params),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<AssetAnalytics>>('/analytics/assets', { params });
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useOccupancyAnalytics(params: AnalyticsQueryParams = {}) {
  return useQuery<ApiSingleResponse<OccupancyAnalytics>>({
    queryKey: analyticsKeys.occupancy(params),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<OccupancyAnalytics>>('/analytics/occupancy', {
        params,
      });
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useParkingAnalytics(params: AnalyticsQueryParams = {}) {
  return useQuery<ApiSingleResponse<ParkingAnalyticsData>>({
    queryKey: analyticsKeys.parking(params),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<ParkingAnalyticsData>>('/analytics/parking', {
        params,
      });
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useAnalyticsReport(params: AnalyticsQueryParams & { category: AnalyticsQueryParams['category'] }) {
  return useQuery<ApiSingleResponse<AnalyticsReport>>({
    queryKey: analyticsKeys.reports(params),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<AnalyticsReport>>('/analytics/reports', { params });
      return data;
    },
    enabled: Boolean(params.category),
    staleTime: 60 * 1000,
  });
}

export async function downloadAnalyticsExport(
  params: AnalyticsQueryParams & { category: string; format: 'csv' | 'json' },
): Promise<void> {
  const response = await api.get('/analytics/export', {
    params,
    responseType: 'blob',
  });
  const mime = params.format === 'csv' ? 'text/csv' : 'application/json';
  const blob = new Blob([response.data], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `analytics-${params.category}.${params.format}`;
  link.click();
  URL.revokeObjectURL(url);
}
