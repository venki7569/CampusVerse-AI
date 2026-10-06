import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumb } from '../ui/Breadcrumb';
import { useAuth } from '../../store/authContext';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../../hooks/useNotifications';
import { useUnreadAnnouncementCount } from '../../hooks/useAnnouncements';
import { useToast } from '../ui/Toast';
import {
  Search,
  Bell,
  Megaphone,
  User,
  LogOut,
  Shield,
  Menu,
  X,
  CheckCheck,
} from 'lucide-react';

interface HeaderProps {
  onOpenSearch: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

function formatRelative(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return value;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onToggleSidebar,
  isSidebarOpen,
}) => {
  const { user, logout, hasAnyRole } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const { data: unreadData } = useUnreadNotificationCount();
  const { data: announcementUnread } = useUnreadAnnouncementCount();
  const { data: latestData } = useNotifications({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = unreadData?.data.unreadCount ?? 0;
  const announcementUnreadCount = announcementUnread?.data.unreadCount ?? 0;
  const latest = latestData?.data ?? [];

  const handleOpenNotification = async (id: string, link: string | null, isRead: boolean) => {
    setShowNotifications(false);
    if (!isRead) {
      try {
        await markRead.mutateAsync(id);
      } catch {
        // Navigation still proceeds
      }
    }
    if (link) {
      navigate(link);
    } else {
      navigate('/notifications');
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead.mutateAsync();
      toast.success('All caught up', 'All notifications marked as read');
    } catch (err: unknown) {
      toast.error('Update failed', err instanceof Error ? err.message : 'Could not mark all as read');
    }
  };

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 shadow-md">
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <Breadcrumb />
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={onOpenSearch}
          className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:border-slate-700 transition-all text-xs"
        >
          <Search className="w-4 h-4 text-slate-500" />
          <span>Quick search...</span>
          <kbd className="bg-slate-900 border border-slate-800 text-[10px] font-mono px-1.5 py-0.5 rounded text-slate-400">
            Ctrl+K
          </kbd>
        </button>

        <button
          onClick={() => navigate('/announcements')}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:border-slate-700 text-xs"
        >
          <Megaphone className="w-4 h-4 text-emerald-400" />
          <span>Announcements</span>
          {announcementUnreadCount > 0 && (
            <span className="min-w-[1.1rem] h-4 px-1 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-bold flex items-center justify-center">
              {announcementUnreadCount > 99 ? '99+' : announcementUnreadCount}
            </span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-4 px-1 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-bold flex items-center justify-center ring-2 ring-slate-900">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden text-slate-100">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center gap-2">
                <h4 className="font-bold text-sm text-white">Notifications</h4>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded">
                      {unreadCount} New
                    </span>
                  )}
                  <button
                    onClick={() => void handleMarkAll()}
                    disabled={unreadCount === 0 || markAllRead.isPending}
                    className="p-1 rounded text-slate-400 hover:text-emerald-400 disabled:opacity-40"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-800/60 max-h-64 overflow-y-auto">
                {latest.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">No notifications yet.</div>
                ) : (
                  latest.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => void handleOpenNotification(n.id, n.link, n.isRead)}
                      className={`w-full text-left p-3.5 hover:bg-slate-800/50 transition-colors text-xs ${
                        n.isRead ? '' : 'bg-emerald-500/5'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className={`font-semibold ${n.isRead ? 'text-slate-300' : 'text-white'}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-slate-500 whitespace-nowrap">
                          {formatRelative(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                    </button>
                  ))
                )}
              </div>
              <div className="p-2 border-t border-slate-800 text-center bg-slate-950/40">
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    navigate('/notifications');
                  }}
                  className="text-xs text-emerald-400 hover:underline font-medium"
                >
                  View Notification Center →
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center space-x-3 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xs">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-white leading-none">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]">
                {user?.roles?.[0]?.replace('_', ' ')}
              </p>
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-1 text-xs text-slate-200">
              <div className="p-3 border-b border-slate-800">
                <p className="font-bold text-white text-sm">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-slate-400 truncate mt-0.5">{user?.email}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/profile');
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
                >
                  <User className="w-4 h-4" />
                  <span>My Profile</span>
                </button>
                {hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN']) && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate('/admin');
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Admin Control</span>
                  </button>
                )}
              </div>
              <div className="pt-1 border-t border-slate-800">
                <button
                  onClick={() => void handleLogout()}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg hover:bg-rose-500/10 text-rose-400 font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
