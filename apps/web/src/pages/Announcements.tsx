import { useMemo, useState } from 'react';
import { Megaphone, Plus, Search, Eye, Send, Archive, XCircle, Clock } from 'lucide-react';
import {
  useAnnouncements,
  useCreateAnnouncement,
  usePublishAnnouncement,
  useArchiveAnnouncement,
  useCancelAnnouncement,
  useMarkAnnouncementRead,
  useUnreadAnnouncementCount,
} from '../hooks/useAnnouncements';
import { useDepartments } from '../hooks/useDepartments';
import { useBuildings } from '../hooks/useBuildings';
import { useAuth } from '../store/authContext';
import { useToast } from '../components/ui/Toast';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { KpiCard } from '../components/ui/KpiCard';
import { AnnouncementComposer } from '../components/announcements/AnnouncementComposer';
import type {
  Announcement,
  AnnouncementPriority,
  AnnouncementStatus,
  CreateAnnouncementInput,
  RoleName,
} from '../types';

function priorityBadge(priority: AnnouncementPriority) {
  const styles: Record<string, string> = {
    URGENT: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    HIGH: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    NORMAL: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
    LOW: 'bg-slate-800/60 text-slate-400 border-slate-700/50',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${styles[priority]}`}>
      {priority}
    </span>
  );
}

function statusBadge(status: AnnouncementStatus) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-slate-700/40 text-slate-300',
    SCHEDULED: 'bg-cyan-500/20 text-cyan-400',
    PUBLISHED: 'bg-emerald-500/20 text-emerald-400',
    EXPIRED: 'bg-slate-600/30 text-slate-400',
    ARCHIVED: 'bg-slate-700/30 text-slate-500',
    CANCELLED: 'bg-rose-500/10 text-rose-300',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${styles[status]}`}>
      {status}
    </span>
  );
}

export function Announcements() {
  const toast = useToast();
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN']);

  const [tab, setTab] = useState<'feed' | 'manage'>(canManage ? 'feed' : 'feed');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const params = useMemo(
    () => ({
      page,
      limit: 10,
      search: search || undefined,
      unreadOnly: unreadOnly || undefined,
      adminView: tab === 'manage' ? true : undefined,
    }),
    [page, search, unreadOnly, tab],
  );

  const { data, isLoading, isError, refetch } = useAnnouncements(params);
  const { data: unreadData } = useUnreadAnnouncementCount();
  const { data: departmentsData } = useDepartments({ page: 1, limit: 100 });
  const { data: buildingsData } = useBuildings({ page: 1, limit: 100 });

  const createMutation = useCreateAnnouncement();
  const publishMutation = usePublishAnnouncement();
  const archiveMutation = useArchiveAnnouncement();
  const cancelMutation = useCancelAnnouncement();
  const markReadMutation = useMarkAnnouncementRead();

  const announcements = data?.data ?? [];
  const unreadCount = unreadData?.data.unreadCount ?? 0;

  const openDetail = async (item: Announcement) => {
    setSelected(item);
    if (!item.isRead) {
      try {
        await markReadMutation.mutateAsync(item.id);
      } catch {
        // detail still opens
      }
    }
  };

  const handleCreate = async (payload: CreateAnnouncementInput) => {
    try {
      await createMutation.mutateAsync(payload);
      toast.success('Announcement saved', 'Draft created successfully');
      setComposerOpen(false);
    } catch (err: unknown) {
      toast.error('Create failed', err instanceof Error ? err.message : 'Could not create announcement');
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await publishMutation.mutateAsync(id);
      toast.success('Published', 'Announcement is now live');
    } catch (err: unknown) {
      toast.error('Publish failed', err instanceof Error ? err.message : 'Could not publish');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Megaphone className="w-7 h-7 text-emerald-400" />
            Campus Announcements
          </h1>
          <p className="text-sm text-slate-400 mt-1">Official campus notices and communications</p>
        </div>
        {canManage && (
          <button
            onClick={() => setComposerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New announcement
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Unread" value={unreadCount} icon={Megaphone} />
        <KpiCard title="In feed" value={announcements.length} icon={Eye} />
        <KpiCard title="View" value={tab === 'feed' ? 'Campus Feed' : 'Admin'} icon={Clock} />
      </div>

      {canManage && (
        <div className="flex gap-2 border-b border-slate-800 pb-2">
          {(['feed', 'manage'] as const).map((key) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                tab === key ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {key === 'feed' ? 'Campus Feed' : 'Manage'}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search announcements..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="rounded border-slate-700"
          />
          Unread only
        </label>
      </div>

      {isError && <ErrorState onRetry={() => void refetch()} />}
      {!isError && isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      )}
      {!isError && !isLoading && announcements.length === 0 && (
        <EmptyState
          icon={Megaphone}
          title="No announcements"
          description="There are no announcements matching your filters."
        />
      )}

      <div className="space-y-3">
        {announcements.map((item) => (
          <article
            key={item.id}
            className={`rounded-xl border p-4 bg-slate-900/60 ${
              item.isRead ? 'border-slate-800' : 'border-emerald-500/30 bg-emerald-500/5'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {!item.isRead && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" title="Unread" />
                  )}
                  <h3 className="font-semibold text-white">{item.title}</h3>
                  {priorityBadge(item.priority)}
                  {tab === 'manage' && statusBadge(item.status)}
                  <span className="text-[10px] uppercase text-slate-500">{item.category}</span>
                </div>
                <p className="text-sm text-slate-400 line-clamp-2">{item.content}</p>
                <p className="text-xs text-slate-500 mt-2">
                  By {item.author.firstName} {item.author.lastName}
                  {item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleString()}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void openDetail(item)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  <Eye className="w-3.5 h-3.5 inline mr-1" />
                  View
                </button>
                {canManage && item.status === 'DRAFT' && (
                  <button
                    onClick={() => void handlePublish(item.id)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <Send className="w-3.5 h-3.5 inline mr-1" />
                    Publish
                  </button>
                )}
                {canManage && item.status === 'SCHEDULED' && (
                  <button
                    onClick={() => void cancelMutation.mutateAsync(item.id)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-rose-500/20 text-rose-300"
                  >
                    <XCircle className="w-3.5 h-3.5 inline mr-1" />
                    Cancel
                  </button>
                )}
                {canManage && item.status === 'PUBLISHED' && (
                  <button
                    onClick={() => void archiveMutation.mutateAsync(item.id)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-slate-700 text-slate-200"
                  >
                    <Archive className="w-3.5 h-3.5 inline mr-1" />
                    Archive
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <Modal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title ?? ''}>
        {selected && (
          <div className="space-y-4 text-sm text-slate-300">
            <div className="flex flex-wrap gap-2">
              {priorityBadge(selected.priority)}
              {statusBadge(selected.status)}
              <span className="text-xs text-slate-500">{selected.category}</span>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed">{selected.content}</p>
            <p className="text-xs text-slate-500">
              Audience: {selected.audienceType}
              {selected.targetDepartment ? ` · ${selected.targetDepartment.name}` : ''}
            </p>
          </div>
        )}
      </Modal>

      <AnnouncementComposer
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleCreate}
        departments={departmentsData?.data ?? []}
        buildings={buildingsData?.data ?? []}
        isSubmitting={createMutation.isPending}
        allowedRoles={
          [
            'SUPER_ADMIN',
            'CAMPUS_ADMIN',
            'DEPARTMENT_ADMIN',
            'FACULTY',
            'STUDENT',
            'MAINTENANCE_STAFF',
            'SECURITY_STAFF',
          ] as RoleName[]
        }
      />
    </div>
  );
}
