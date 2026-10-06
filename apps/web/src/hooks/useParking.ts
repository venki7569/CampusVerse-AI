import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { dashboardKeys } from './useDashboard';
import type {
  AllocateParkingSlotInput,
  ApiListResponse,
  ApiSingleResponse,
  CreateParkingAreaInput,
  CreateParkingSlotInput,
  ParkingArea,
  ParkingAvailability,
  ParkingQueryParams,
  ParkingSlot,
  UpdateParkingAreaInput,
  UpdateParkingSlotInput,
} from '../types';

export const parkingKeys = {
  all: ['parking'] as const,
  areas: () => [...parkingKeys.all, 'areas'] as const,
  areaList: (params: ParkingQueryParams) => [...parkingKeys.areas(), 'list', params] as const,
  area: (id: string) => [...parkingKeys.areas(), 'detail', id] as const,
  slots: () => [...parkingKeys.all, 'slots'] as const,
  slotList: (params: ParkingQueryParams) => [...parkingKeys.slots(), 'list', params] as const,
  slot: (id: string) => [...parkingKeys.slots(), 'detail', id] as const,
  availability: (params: ParkingQueryParams = {}) =>
    [...parkingKeys.all, 'availability', params] as const,
  metrics: () => [...parkingKeys.all, 'metrics'] as const,
};

function invalidateParking(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: parkingKeys.all });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
}

export function useParkingAreas(params: ParkingQueryParams = {}) {
  return useQuery<ApiListResponse<ParkingArea>>({
    queryKey: parkingKeys.areaList(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<ParkingArea>>('/parking/areas', { params });
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useParkingArea(id: string) {
  return useQuery<ApiSingleResponse<ParkingArea>>({
    queryKey: parkingKeys.area(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<ParkingArea>>(`/parking/areas/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateParkingArea() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<ParkingArea>, Error, CreateParkingAreaInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ApiSingleResponse<ParkingArea>>('/parking/areas', payload);
      return data;
    },
    onSuccess: () => invalidateParking(queryClient),
  });
}

export function useUpdateParkingArea() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiSingleResponse<ParkingArea>,
    Error,
    { id: string; data: UpdateParkingAreaInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.patch<ApiSingleResponse<ParkingArea>>(
        `/parking/areas/${id}`,
        payload,
      );
      return data;
    },
    onSuccess: (_result, variables) => {
      invalidateParking(queryClient);
      queryClient.invalidateQueries({ queryKey: parkingKeys.area(variables.id) });
    },
  });
}

export function useArchiveParkingArea() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<ParkingArea>, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.patch<ApiSingleResponse<ParkingArea>>(`/parking/areas/${id}`, {
        isActive: false,
      });
      return data;
    },
    onSuccess: () => invalidateParking(queryClient),
  });
}

export function useDeleteParkingArea() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/parking/areas/${id}`);
    },
    onSuccess: () => invalidateParking(queryClient),
  });
}

export function useParkingSlots(params: ParkingQueryParams = {}) {
  return useQuery<ApiListResponse<ParkingSlot>>({
    queryKey: parkingKeys.slotList(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<ParkingSlot>>('/parking/slots', { params });
      return data;
    },
    staleTime: 20 * 1000,
  });
}

export function useParkingSlot(id: string) {
  return useQuery<ApiSingleResponse<ParkingSlot>>({
    queryKey: parkingKeys.slot(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<ParkingSlot>>(`/parking/slots/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateParkingSlot() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<ParkingSlot>, Error, CreateParkingSlotInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ApiSingleResponse<ParkingSlot>>('/parking/slots', payload);
      return data;
    },
    onSuccess: () => invalidateParking(queryClient),
  });
}

export function useUpdateParkingSlot() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiSingleResponse<ParkingSlot>,
    Error,
    { id: string; data: UpdateParkingSlotInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.patch<ApiSingleResponse<ParkingSlot>>(
        `/parking/slots/${id}`,
        payload,
      );
      return data;
    },
    onSuccess: (_result, variables) => {
      invalidateParking(queryClient);
      queryClient.invalidateQueries({ queryKey: parkingKeys.slot(variables.id) });
    },
  });
}

export function useArchiveParkingSlot() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<ParkingSlot>, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.patch<ApiSingleResponse<ParkingSlot>>(
        `/parking/slots/${id}/archive`,
      );
      return data;
    },
    onSuccess: () => invalidateParking(queryClient),
  });
}

export function useAllocateParkingSlot() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiSingleResponse<ParkingSlot>,
    Error,
    { id: string; data: AllocateParkingSlotInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.post<ApiSingleResponse<ParkingSlot>>(
        `/parking/slots/${id}/allocate`,
        payload,
      );
      return data;
    },
    onSuccess: () => invalidateParking(queryClient),
  });
}

export function useReleaseParkingSlot() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<ParkingSlot>, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.post<ApiSingleResponse<ParkingSlot>>(
        `/parking/slots/${id}/release`,
      );
      return data;
    },
    onSuccess: () => invalidateParking(queryClient),
  });
}

export function useParkingAvailability(params: ParkingQueryParams = {}) {
  return useQuery<ApiSingleResponse<ParkingAvailability>>({
    queryKey: parkingKeys.availability(params),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<ParkingAvailability>>(
        '/parking/availability',
        { params },
      );
      return data;
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}
