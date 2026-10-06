import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ApiSingleResponse } from '../types';

export interface DigitalTwinOverview {
  summary: {
    buildings: number;
    floors: number;
    rooms: number;
    assets: number;
    openMaintenance: number;
    openRecommendations: number;
  };
  health: {
    overallScore: number;
    healthLevel: string;
    formula: string;
    dimensions: Array<{ key: string; label: string; score: number; explanation: string }>;
    topRisks: string[];
    recommendedActions: string[];
    calculatedAt: string;
  };
  occupancy: {
    scope: string;
    utilizationRate: number | null;
    occupied: number;
    total: number;
    explanation: string;
  };
  maintenanceRisks: {
    highRiskCount: number;
    topRisks: Array<{
      assetId: string;
      assetTag: string;
      assetName: string;
      maintenanceRiskScore: number;
      riskLevel: string;
      riskFactors: string[];
      recommendedAction: string;
      explanation: string;
    }>;
  };
  utilityAnomalies: {
    count: number;
    anomalies: Array<{
      metric: string;
      entityLabel: string;
      severity: string;
      explanation: string;
      recommendedAction: string;
    }>;
  };
  buildings: Array<{
    id: string;
    code: string;
    name: string;
    operationalStatus: string;
    floorCount: number;
    roomCount: number;
    occupancyRate: number | null;
    healthScore: number | null;
  }>;
  alerts: { criticalRecommendations: number; highRecommendations: number };
  iot?: {
    totalDevices: number;
    online: number;
    offline: number;
    stale: number;
    maintenance: number;
    activeAlerts: number;
  };
  lastUpdated: string;
}

export const digitalTwinKeys = {
  all: ['digital-twin'] as const,
  overview: () => [...digitalTwinKeys.all, 'overview'] as const,
  building: (id: string) => [...digitalTwinKeys.all, 'building', id] as const,
  health: () => [...digitalTwinKeys.all, 'health'] as const,
};

export function useDigitalTwinOverview() {
  return useQuery<ApiSingleResponse<DigitalTwinOverview>>({
    queryKey: digitalTwinKeys.overview(),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<DigitalTwinOverview>>('/digital-twin/overview');
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useDigitalTwinHealth() {
  return useQuery({
    queryKey: digitalTwinKeys.health(),
    queryFn: async () => {
      const { data } = await api.get('/digital-twin/health');
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useSyncRecommendations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/digital-twin/recommendations/sync');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: digitalTwinKeys.all });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });
}
