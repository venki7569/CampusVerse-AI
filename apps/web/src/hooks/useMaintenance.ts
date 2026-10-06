import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  MaintenanceRequest,
  MaintenanceComment,
  MaintenanceMetrics,
  MaintenanceQueryParams,
  CreateMaintenanceRequestInput,
  UpdateMaintenanceRequestInput,
  AssignMaintenanceRequestInput,
  ResolveMaintenanceRequestInput,
  CloseMaintenanceRequestInput,
  CancelOrRejectMaintenanceRequestInput,
  CreateMaintenanceCommentInput,
  ApiListResponse,
  ApiSingleResponse,
} from '../types';

export const maintenanceKeys = {
  all: ['maintenance'] as const,
  lists: () => ['maintenance', 'list'] as const,
  list: (params: MaintenanceQueryParams) => ['maintenance', 'list', params] as const,
  details: () => ['maintenance', 'detail'] as const,
  detail: (id: string) => ['maintenance', 'detail', id] as const,
  metrics: () => ['maintenance', 'metrics'] as const,
  technicians: () => ['maintenance', 'technicians'] as const,
  comments: (id: string) => ['maintenance', 'comments', id] as const,
};

export function useMaintenanceRequests(params: MaintenanceQueryParams = {}) {
  return useQuery<ApiListResponse<MaintenanceRequest>>({
    queryKey: maintenanceKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<MaintenanceRequest>>('/maintenance', {
        params,
      });
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useMaintenanceRequest(id: string) {
  return useQuery<ApiSingleResponse<MaintenanceRequest>>({
    queryKey: maintenanceKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<MaintenanceRequest>>(`/maintenance/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useMaintenanceMetrics() {
  return useQuery<ApiSingleResponse<MaintenanceMetrics>>({
    queryKey: maintenanceKeys.metrics(),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<MaintenanceMetrics>>('/maintenance/metrics');
      return data;
    },
    staleTime: 60 * 1000,
  });
}

export function useMaintenanceTechnicians() {
  return useQuery<ApiSingleResponse<Array<{ id: string; firstName: string; lastName: string; email: string }>>>({
    queryKey: maintenanceKeys.technicians(),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<Array<{ id: string; firstName: string; lastName: string; email: string }>>>('/maintenance/technicians');
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useMaintenanceComments(requestId: string) {
  return useQuery<ApiSingleResponse<MaintenanceComment[]>>({
    queryKey: maintenanceKeys.comments(requestId),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<MaintenanceComment[]>>(`/maintenance/${requestId}/comments`);
      return data;
    },
    enabled: Boolean(requestId),
  });
}

export function useCreateMaintenanceRequest() {
  const queryClient = useQueryClient();

  return useMutation<ApiSingleResponse<MaintenanceRequest>, Error, CreateMaintenanceRequestInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ApiSingleResponse<MaintenanceRequest>>('/maintenance', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.metrics() });
    },
  });
}

export function useUpdateMaintenanceRequest() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiSingleResponse<MaintenanceRequest>,
    Error,
    { id: string; data: UpdateMaintenanceRequestInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.patch<ApiSingleResponse<MaintenanceRequest>>(`/maintenance/${id}`, payload);
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.detail(variables.id) });
    },
  });
}

export function useAssignMaintenanceRequest() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiSingleResponse<{ request: MaintenanceRequest }>,
    Error,
    { id: string; data: AssignMaintenanceRequestInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.post<ApiSingleResponse<{ request: MaintenanceRequest }>>(`/maintenance/${id}/assign`, payload);
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.metrics() });
    },
  });
}

export function useStartMaintenance() {
  const queryClient = useQueryClient();

  return useMutation<ApiSingleResponse<MaintenanceRequest>, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.post<ApiSingleResponse<MaintenanceRequest>>(`/maintenance/${id}/start`);
      return data;
    },
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.metrics() });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useResolveMaintenanceRequest() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiSingleResponse<MaintenanceRequest>,
    Error,
    { id: string; data: ResolveMaintenanceRequestInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.post<ApiSingleResponse<MaintenanceRequest>>(`/maintenance/${id}/resolve`, payload);
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.metrics() });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.comments(variables.id) });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useCloseMaintenanceRequest() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiSingleResponse<MaintenanceRequest>,
    Error,
    { id: string; data: CloseMaintenanceRequestInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.post<ApiSingleResponse<MaintenanceRequest>>(`/maintenance/${id}/close`, payload);
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.metrics() });
    },
  });
}

export function useCancelMaintenanceRequest() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiSingleResponse<MaintenanceRequest>,
    Error,
    { id: string; data: CancelOrRejectMaintenanceRequestInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.post<ApiSingleResponse<MaintenanceRequest>>(`/maintenance/${id}/cancel`, payload);
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.metrics() });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useRejectMaintenanceRequest() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiSingleResponse<MaintenanceRequest>,
    Error,
    { id: string; data: CancelOrRejectMaintenanceRequestInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.post<ApiSingleResponse<MaintenanceRequest>>(`/maintenance/${id}/reject`, payload);
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.metrics() });
    },
  });
}

export function useAddMaintenanceComment() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiSingleResponse<MaintenanceComment>,
    Error,
    { id: string; data: CreateMaintenanceCommentInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.post<ApiSingleResponse<MaintenanceComment>>(`/maintenance/${id}/comments`, payload);
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.comments(variables.id) });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.detail(variables.id) });
    },
  });
}
