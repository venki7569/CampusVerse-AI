import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Trash2,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from '../hooks/useNotifications';
import { useToast } from '../components/ui/Toast';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { KpiCard } from '../components/ui/KpiCard';
import type { AppNotification, NotificationSeverity } from '../types';

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function severityBadge(severity: string | null) {
  const value = severity ?? 'INFO';
  const styles: Record<string, string> = {
    CRITICAL: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    HIGH: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    WARNING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    MEDIUM: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    LOW: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
    INFO: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
    SUCCESS: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[value] ?? styles.INFO}`}
    >
      {value}
    </span>
  );
}

function typeBadge(type: string) {
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
      {type.replace(/_/g, ' ')}
    </span>
  );
}

export function Notifications() {
  const toast = useToast();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState<NotificationSeverity | ''>('');
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const limit = 10;

  const params = useMemo(
    () => ({
      page,
      limit,
      search: search || undefined,
      unreadOnly: unreadOnly || undefined,
      type: type || undefined,
      severity: severity || undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc' as const,
    }),
    [page, search, unreadOnly, type, severity],
  );

  const { data, isLoading, isError, refetch } = useNotifications(params);
  const { data: unreadData } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  const notifications = data?.data ?? [];
  const pagination = data?.meta.pagination;
  const unreadCount = unreadData?.data.unreadCount ?? 0;

  const groupedByDate = useMemo(() => {
    const items = data?.data ?? [];
    const groups = new Map<string, AppNotification[]>();
    for (const item of items) {
      const key = new Date(item.createdAt).toLocaleDateString();
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [data?.data]);

  const handleMarkRead = async (item: AppNotification) => {
    if (item.isRead) return;
    try {
      await markRead.mutateAsync(item.id);
      toast.success('Marked as read', item.title);
    } catch (err: unknown) {
      toast.error('Update failed', err instanceof Error ? err.message : 'Could not mark as read');
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

  const handleDelete = async (item: AppNotification) => {
    try {
      await deleteNotification.mutateAsync(item.id);
      if (selected?.id === item.id) setSelected(null);
      toast.success('Dismissed', 'Notification removed');
    } catch (err: unknown) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Could not dismiss notification');
    }
  };

  const handleOpen = async (item: AppNotification) => {
    setSelected(item);
    if (!item.isRead) {
      try {
        await markRead.mutateAsync(item.id);
      } catch {
        // Detail still opens even if mark-read fails
      }
    }
  };

  const columns: Column<AppNotification>[] = [
    {
      header: 'Status',
      cell: (row) =>
        row.isRead ? (
          <span className="text-[10px] uppercase text-slate-500 font-semibold">Read</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Unread
          </span>
        ),
    },
    {
      header: 'Notification',
      cell: (row) => (
        <div>
          <p className={`text-sm ${row.isRead ? 'text-slate-300' : 'text-white font-semibold'}`}>
            {row.title}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{row.message}</p>
        </div>
      ),
    },
    { header: 'Type', cell: (row) => typeBadge(row.type) },
    { header: 'Severity', cell: (row) => severityBadge(row.severity) },
    {
      header: 'When',
      cell: (row) => (
        <div className="text-xs text-slate-400">
          <div>{formatRelative(row.createdAt)}</div>
          <div className="text-[10px] text-slate-600">{formatTimestamp(row.createdAt)}</div>
        </div>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => void handleOpen(row)}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
            title="View"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {!row.isRead && (
            <button
              onClick={() => void handleMarkRead(row)}
              className="p-1.5 rounded-lg border border-slate-800 text-emerald-400 hover:bg-emerald-500/10"
              title="Mark as read"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => void handleDelete(row)}
            className="p-1.5 rounded-lg border border-slate-800 text-rose-400 hover:bg-rose-500/10"
            title="Dismiss"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <Breadcrumb />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Notification Center</h1>
          <p className="text-slate-400 text-sm mt-1">
            Operational alerts from maintenance, utilities, and campus systems.
          </p>
        </div>
        <button
          onClick={() => void handleMarkAll()}
          disabled={unreadCount === 0 || markAllRead.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-400 text-slate-950 text-xs font-bold hover:bg-emerald-300 disabled:opacity-50"
        >
          <CheckCheck className="w-4 h-4" />
          Mark all as read
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Unread" value={unreadCount} icon={Bell} variant={unreadCount > 0 ? 'warning' : 'success'} />
        <KpiCard title="On this page" value={notifications.length} icon={Info} variant="info" />
        <KpiCard
          title="Total matching"
          value={pagination?.total ?? 0}
          icon={AlertTriangle}
          subtitle={unreadOnly ? 'Unread filter active' : 'All statuses'}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search notifications..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500"
          />
        </div>
        <select
          value={type}
          onChange={(e) => {
            setPage(1);
            setType(e.target.value);
          }}
          className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
        >
          <option value="">All types</option>
          <option value="MAINTENANCE_ASSIGNED">Maintenance assigned</option>
          <option value="MAINTENANCE_RESOLVED">Maintenance resolved</option>
          <option value="MAINTENANCE_UPDATE">Maintenance update</option>
          <option value="MAINTENANCE_COMMENT">Maintenance comment</option>
          <option value="UTILITY_ANOMALY">Utility anomaly</option>
          <option value="SYSTEM">System</option>
        </select>
        <select
          value={severity}
          onChange={(e) => {
            setPage(1);
            setSeverity(e.target.value as NotificationSeverity | '');
          }}
          className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
        >
          <option value="">All severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="WARNING">Warning</option>
          <option value="MEDIUM">Medium</option>
          <option value="INFO">Info</option>
          <option value="SUCCESS">Success</option>
          <option value="LOW">Low</option>
        </select>
        <button
          onClick={() => {
            setPage(1);
            setUnreadOnly((v) => !v);
          }}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${
            unreadOnly
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-slate-950 border-slate-800 text-slate-300'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Unread only
        </button>
      </div>

      {isError && (
        <ErrorState
          title="Notifications unavailable"
          message="Could not load your notification inbox."
          onRetry={() => void refetch()}
        />
      )}

      {!isError && (
        <DataTable
          columns={columns}
          data={notifications}
          isLoading={isLoading}
          emptyTitle="No notifications"
          emptyDescription="You're all caught up. Operational alerts will appear here."
          pagination={
            pagination
              ? {
                  page: pagination.page,
                  limit: pagination.limit,
                  total: pagination.total,
                  totalPages: pagination.totalPages,
                  onPageChange: setPage,
                }
              : undefined
          }
        />
      )}

      {!isLoading && !isError && groupedByDate.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">By date</h2>
          {groupedByDate.map(([day, items]) => (
            <div key={day} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 mb-3">{day}</p>
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => void handleOpen(item)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      item.isRead
                        ? 'border-slate-800 bg-slate-950/40'
                        : 'border-emerald-500/20 bg-emerald-500/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-white font-medium">{item.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{item.message}</p>
                      </div>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        {formatRelative(item.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !isError && notifications.length === 0 && (
        <EmptyState
          icon={Bell}
          title="Inbox empty"
          description="No notifications match the current filters."
        />
      )}

      <Modal
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title ?? 'Notification'}
        subtitle={selected ? formatTimestamp(selected.createdAt) : undefined}
      >
        {selected && (
          <div className="space-y-4 text-sm text-slate-300">
            <div className="flex flex-wrap gap-2">
              {typeBadge(selected.type)}
              {severityBadge(selected.severity)}
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                  selected.isRead
                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {selected.isRead ? 'Read' : 'Unread'}
              </span>
            </div>
            <p>{selected.message}</p>
            {selected.link && (
              <button
                onClick={() => {
                  navigate(selected.link!);
                  setSelected(null);
                }}
                className="text-xs font-semibold text-emerald-400 hover:underline"
              >
                Open related page →
              </button>
            )}
            <div className="flex gap-2 pt-2">
              {!selected.isRead && (
                <button
                  onClick={() => void handleMarkRead(selected)}
                  className="px-3 py-2 rounded-lg bg-emerald-400 text-slate-950 text-xs font-bold"
                >
                  Mark as read
                </button>
              )}
              <button
                onClick={() => void handleDelete(selected)}
                className="px-3 py-2 rounded-lg border border-rose-500/30 text-rose-400 text-xs font-bold"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
