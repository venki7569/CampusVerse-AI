import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ApiSingleResponse, DashboardOverview, DashboardQueryParams } from '../types';
import { subscribeToDashboardEvents } from '../services/dashboardEvents';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  overviews: () => [...dashboardKeys.all, 'overview'] as const,
  overview: (params: DashboardQueryParams) => [...dashboardKeys.overviews(), params] as const,
};

export function useDashboard(params: DashboardQueryParams = {}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    return subscribeToDashboardEvents(() => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    });
  }, [queryClient]);

  return useQuery<ApiSingleResponse<DashboardOverview>>({
    queryKey: dashboardKeys.overview(params),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<DashboardOverview>>('/dashboard/overview', {
        params,
      });
      return data;
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
