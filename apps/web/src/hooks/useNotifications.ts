import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { subscribeToNotificationEvents, notifyNotificationEvent } from '../services/notificationEvents';
import type {
  ApiSingleResponse,
  AppNotification,
  NotificationListResponse,
  NotificationQueryParams,
  UnreadNotificationCount,
} from '../types';
import { dashboardKeys } from './useDashboard';

export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (params: NotificationQueryParams) => [...notificationKeys.lists(), params] as const,
  details: () => [...notificationKeys.all, 'detail'] as const,
  detail: (id: string) => [...notificationKeys.details(), id] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

export function useNotifications(params: NotificationQueryParams = {}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    return subscribeToNotificationEvents(() => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    });
  }, [queryClient]);

  return useQuery<NotificationListResponse>({
    queryKey: notificationKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<NotificationListResponse>('/notifications', { params });
      return data;
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useNotification(id: string) {
  return useQuery<ApiSingleResponse<AppNotification>>({
    queryKey: notificationKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<AppNotification>>(`/notifications/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useUnreadNotificationCount() {
  const queryClient = useQueryClient();

  useEffect(() => {
    return subscribeToNotificationEvents(() => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    });
  }, [queryClient]);

  return useQuery<ApiSingleResponse<UnreadNotificationCount>>({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<UnreadNotificationCount>>(
        '/notifications/unread-count',
      );
      return data;
    },
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation<ApiSingleResponse<AppNotification>, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.patch<ApiSingleResponse<AppNotification>>(
        `/notifications/${id}/read`,
      );
      return data;
    },
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      notifyNotificationEvent('notification.read');
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiSingleResponse<{ modifiedCount: number; unreadCount: number }>,
    Error,
    void
  >({
    mutationFn: async () => {
      const { data } = await api.patch<
        ApiSingleResponse<{ modifiedCount: number; unreadCount: number }>
      >('/notifications/read-all');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      notifyNotificationEvent('notification.readAll');
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/notifications/${id}`);
    },
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      notifyNotificationEvent('notification.deleted');
    },
  });
}
