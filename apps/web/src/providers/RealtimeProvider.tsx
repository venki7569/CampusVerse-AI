import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../store/authContext';
import { connectSocket, disconnectSocket, subscribeToRealtime } from '../services/socket';
import { dashboardKeys } from '../hooks/useDashboard';
import { notificationKeys } from '../hooks/useNotifications';
import { announcementKeys } from '../hooks/useAnnouncements';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disconnectSocket();
      return;
    }

    connectSocket(accessToken);
    return () => disconnectSocket();
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    return subscribeToRealtime((envelope) => {
      switch (envelope.channel) {
        case 'dashboard':
          queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
          break;
        case 'notification':
          queryClient.invalidateQueries({ queryKey: notificationKeys.all });
          break;
        case 'announcement':
          queryClient.invalidateQueries({ queryKey: announcementKeys.all });
          break;
        case 'parking':
          queryClient.invalidateQueries({ queryKey: ['parking'] });
          break;
        case 'maintenance':
          queryClient.invalidateQueries({ queryKey: ['maintenance'] });
          break;
        case 'analytics':
          queryClient.invalidateQueries({ queryKey: ['analytics'] });
          break;
        case 'digital-twin':
          queryClient.invalidateQueries({ queryKey: ['digital-twin'] });
          queryClient.invalidateQueries({ queryKey: ['recommendations'] });
          break;
        case 'iot':
          queryClient.invalidateQueries({ queryKey: ['iot'] });
          queryClient.invalidateQueries({ queryKey: ['digital-twin'] });
          break;
        default:
          break;
      }
    });
  }, [queryClient]);

  return <>{children}</>;
}
