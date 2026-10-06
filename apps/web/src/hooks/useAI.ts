import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  AIChatRequest,
  AIChatResponse,
  AIConversationDetail,
  AIConversationSummary,
  AIStatus,
  ApiListResponse,
  ApiSingleResponse,
} from '../types';

export const aiKeys = {
  all: ['ai'] as const,
  status: () => [...aiKeys.all, 'status'] as const,
  conversations: () => [...aiKeys.all, 'conversations'] as const,
  conversationList: (page: number, limit: number) =>
    [...aiKeys.conversations(), { page, limit }] as const,
  conversation: (id: string) => [...aiKeys.all, 'conversation', id] as const,
};

export function useAIStatus() {
  return useQuery<ApiSingleResponse<AIStatus>>({
    queryKey: aiKeys.status(),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<AIStatus>>('/ai/status');
      return data;
    },
    staleTime: 60 * 1000,
  });
}

export function useAIConversations(page = 1, limit = 20) {
  return useQuery<ApiListResponse<AIConversationSummary>>({
    queryKey: aiKeys.conversationList(page, limit),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<AIConversationSummary>>('/ai/conversations', {
        params: { page, limit },
      });
      return data;
    },
  });
}

export function useAIConversation(id: string | null) {
  return useQuery<ApiSingleResponse<AIConversationDetail>>({
    queryKey: aiKeys.conversation(id ?? ''),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<AIConversationDetail>>(
        `/ai/conversations/${id}`,
      );
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useSendAIMessage() {
  const queryClient = useQueryClient();

  return useMutation<ApiSingleResponse<AIChatResponse>, Error, AIChatRequest>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ApiSingleResponse<AIChatResponse>>('/ai/chat', payload);
      return data;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: aiKeys.conversations() });
      if (response.data.conversationId) {
        queryClient.invalidateQueries({
          queryKey: aiKeys.conversation(response.data.conversationId),
        });
      }
    },
  });
}

export function useDeleteAIConversation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/ai/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.conversations() });
    },
  });
}
