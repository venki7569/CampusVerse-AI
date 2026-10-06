import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ApiListResponse, ApiSingleResponse } from '../types';

export const iotKeys = {
  all: ['iot'] as const,
  summary: () => [...iotKeys.all, 'summary'] as const,
  devices: (filters?: Record<string, unknown>) => [...iotKeys.all, 'devices', filters] as const,
  device: (id: string) => [...iotKeys.all, 'device', id] as const,
  health: (id: string) => [...iotKeys.all, 'health', id] as const,
  actions: (status?: string) => [...iotKeys.all, 'actions', status] as const,
};

export interface IoTDevice {
  id: string;
  deviceId: string;
  name: string;
  type: string;
  status: string;
  lastSeenAt: string | null;
  building?: { id: string; name: string; code: string } | null;
  room?: { id: string; roomNumber: string } | null;
  isActive: boolean;
}

export interface IoTSummary {
  totalDevices: number;
  online: number;
  offline: number;
  stale: number;
  maintenance: number;
  staleDeviceIds: string[];
}

export interface DeviceHealth {
  status: string;
  lastSeenAt: string | null;
  healthScore: number;
  issues: Array<{ code: string; message: string; severity: string }>;
  recommendedAction: string | null;
  dataFreshness: 'LIVE' | 'STALE' | 'UNKNOWN';
}

export interface OperationalAction {
  _id: string;
  type: string;
  status: string;
  title: string;
  description: string;
  reason: string;
  source: string;
  evidence: Record<string, unknown>;
  affectedEntity: { type: string; id: string; label: string };
  createdAt: string;
}

export function useIoTSummary() {
  return useQuery({
    queryKey: iotKeys.summary(),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<IoTSummary>>('/iot/summary');
      return data.data;
    },
  });
}

export function useIoTDevices(params?: Record<string, string | number | boolean>) {
  return useQuery({
    queryKey: iotKeys.devices(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<IoTDevice>>('/iot/devices', { params });
      return data;
    },
  });
}

export function useIoTDevice(id: string) {
  return useQuery({
    queryKey: iotKeys.device(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<IoTDevice>>(`/iot/devices/${id}`);
      return data.data;
    },
    enabled: Boolean(id),
  });
}

export function useDeviceHealth(id: string) {
  return useQuery({
    queryKey: iotKeys.health(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<DeviceHealth>>(`/iot/devices/${id}/health`);
      return data.data;
    },
    enabled: Boolean(id),
  });
}

export function useOperationalActions(status = 'PROPOSED') {
  return useQuery({
    queryKey: iotKeys.actions(status),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<OperationalAction>>('/iot/actions', {
        params: { status, page: 1, limit: 20 },
      });
      return data;
    },
  });
}

export function useApproveAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<ApiSingleResponse<OperationalAction>>(`/iot/actions/${id}/approve`);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: iotKeys.actions() });
    },
  });
}

export function useRejectAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await api.post<ApiSingleResponse<OperationalAction>>(`/iot/actions/${id}/reject`, { reason });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: iotKeys.actions() });
    },
  });
}
