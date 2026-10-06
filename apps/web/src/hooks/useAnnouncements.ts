import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  Announcement,
  AnnouncementFeedSummary,
  AnnouncementQueryParams,
  ApiListResponse,
  ApiSingleResponse,
  CreateAnnouncementInput,
  ScheduleAnnouncementInput,
  UnreadAnnouncementCount,
  UpdateAnnouncementInput,
} from '../types';

export const announcementKeys = {
  all: ['announcements'] as const,
  lists: () => [...announcementKeys.all, 'list'] as const,
  list: (params: AnnouncementQueryParams) => [...announcementKeys.lists(), params] as const,
  details: () => [...announcementKeys.all, 'detail'] as const,
  detail: (id: string) => [...announcementKeys.details(), id] as const,
  unreadCount: () => [...announcementKeys.all, 'unread-count'] as const,
  feedSummary: () => [...announcementKeys.all, 'feed-summary'] as const,
};

export function useAnnouncements(params: AnnouncementQueryParams = {}) {
  return useQuery<ApiListResponse<Announcement>>({
    queryKey: announcementKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<Announcement>>('/announcements', { params });
      return data;
    },
  });
}

export function useAnnouncement(id: string) {
  return useQuery<ApiSingleResponse<Announcement>>({
    queryKey: announcementKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<Announcement>>(`/announcements/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useUnreadAnnouncementCount() {
  return useQuery<ApiSingleResponse<UnreadAnnouncementCount>>({
    queryKey: announcementKeys.unreadCount(),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<UnreadAnnouncementCount>>(
        '/announcements/unread-count',
      );
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useAnnouncementFeedSummary() {
  return useQuery<ApiSingleResponse<AnnouncementFeedSummary>>({
    queryKey: announcementKeys.feedSummary(),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<AnnouncementFeedSummary>>(
        '/announcements/feed-summary',
      );
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<Announcement>, Error, CreateAnnouncementInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ApiSingleResponse<Announcement>>('/announcements', payload);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiSingleResponse<Announcement>,
    Error,
    { id: string; payload: UpdateAnnouncementInput }
  >({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.patch<ApiSingleResponse<Announcement>>(
        `/announcements/${id}`,
        payload,
      );
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}

export function usePublishAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<Announcement>, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.post<ApiSingleResponse<Announcement>>(`/announcements/${id}/publish`);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}

export function useScheduleAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiSingleResponse<Announcement>,
    Error,
    { id: string; payload: ScheduleAnnouncementInput }
  >({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.post<ApiSingleResponse<Announcement>>(
        `/announcements/${id}/schedule`,
        payload,
      );
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}

export function useCancelAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<Announcement>, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.post<ApiSingleResponse<Announcement>>(`/announcements/${id}/cancel`);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}

export function useArchiveAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<Announcement>, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.post<ApiSingleResponse<Announcement>>(`/announcements/${id}/archive`);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/announcements/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}

export function useMarkAnnouncementRead() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<Announcement>, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.patch<ApiSingleResponse<Announcement>>(`/announcements/${id}/read`);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}
