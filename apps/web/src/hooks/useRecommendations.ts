import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ApiListResponse, ApiSingleResponse } from '../types';

export interface Recommendation {
  id: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendedAction: string;
  affectedEntity: { type: string; id: string; label: string };
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationQueryParams {
  page?: number;
  limit?: number;
  type?: string;
  severity?: string;
  status?: string;
  search?: string;
}

export const recommendationKeys = {
  all: ['recommendations'] as const,
  list: (params: RecommendationQueryParams) => [...recommendationKeys.all, 'list', params] as const,
};

export function useRecommendations(params: RecommendationQueryParams = {}) {
  return useQuery<ApiListResponse<Recommendation>>({
    queryKey: recommendationKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<Recommendation>>('/digital-twin/recommendations', {
        params,
      });
      return data;
    },
  });
}

export function useAcknowledgeRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<ApiSingleResponse<Recommendation>>(
        `/digital-twin/recommendations/${id}/acknowledge`,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recommendationKeys.all }),
  });
}

export function useDismissRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<ApiSingleResponse<Recommendation>>(
        `/digital-twin/recommendations/${id}/dismiss`,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recommendationKeys.all }),
  });
}

export function useResolveRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<ApiSingleResponse<Recommendation>>(
        `/digital-twin/recommendations/${id}/resolve`,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recommendationKeys.all }),
  });
}
