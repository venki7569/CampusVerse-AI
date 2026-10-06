import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  Eye,
  Building as BuildingIcon,
  DoorOpen,
  Calendar,
  AlertTriangle,
  Send,
  Boxes,
  UserCheck,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Image as ImageIcon,
} from 'lucide-react';
import {
  useMaintenanceRequests,
  useMaintenanceRequest,
  useMaintenanceMetrics,
  useMaintenanceTechnicians,
  useCreateMaintenanceRequest,
  useAssignMaintenanceRequest,
  useStartMaintenance,
  useResolveMaintenanceRequest,
  useCloseMaintenanceRequest,
  useCancelMaintenanceRequest,
  useRejectMaintenanceRequest,
  useAddMaintenanceComment,
} from '../hooks/useMaintenance';
import { useBuildings } from '../hooks/useBuildings';
import { useFloors } from '../hooks/useFloors';
import { useRooms } from '../hooks/useRooms';
import { useAssets } from '../hooks/useAssets';
import { useAuth } from '../store/authContext';
import { useToast } from '../components/ui/Toast';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { KpiCard } from '../components/ui/KpiCard';
import type {
  MaintenanceRequest,
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceCategory,
  CreateMaintenanceRequestInput,
  MaintenanceQueryParams,
} from '../types';

const STATUS_LIST: MaintenanceStatus[] = [
  'REPORTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
  'CANCELLED',
];

const PRIORITY_LIST: MaintenancePriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const CATEGORY_LIST: MaintenanceCategory[] = [
  'ELECTRICAL',
  'PLUMBING',
  'HVAC',
  'NETWORK',
  'IT_EQUIPMENT',
  'FURNITURE',
  'CLEANING',
  'CIVIL',
  'SAFETY',
  'OTHER',
];

export function Maintenance() {
  const { user, hasAnyRole } = useAuth();
  const toast = useToast();

  const isStaffOrAdmin = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF']);
  const canAssign = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF']);
  const canClose = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN']);

  // ── Filters & Pagination State ─────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<MaintenanceStatus | ''>('');
  const [selectedPriority, setSelectedPriority] = useState<MaintenancePriority | ''>('');
  const [selectedCategory, setSelectedCategory] = useState<MaintenanceCategory | ''>('');
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Auxiliary queries
  const { data: metricsData } = useMaintenanceMetrics();
  const metrics = metricsData?.data;

  const { data: techniciansData } = useMaintenanceTechnicians();
  const technicians = techniciansData?.data || [];

  const { data: buildingsData } = useBuildings({ limit: 100 });
  const buildings = buildingsData?.data || [];

  const { data: roomsData } = useRooms({ buildingId: selectedBuilding || undefined, limit: 100 });
  const rooms = roomsData?.data || [];

  const queryParams: MaintenanceQueryParams = {
    page,
    limit,
    search: search || undefined,
    status: selectedStatus || undefined,
    priority: selectedPriority || undefined,
    categoryId: selectedCategory || undefined,
    buildingId: selectedBuilding || undefined,
    roomId: selectedRoom || undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  const { data: requestsData, isLoading, isError } = useMaintenanceRequests(queryParams);
  const requests = requestsData?.data || [];
  const pagination = requestsData?.meta?.pagination;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useCreateMaintenanceRequest();
  const assignMutation = useAssignMaintenanceRequest();
  const startMutation = useStartMaintenance();
  const resolveMutation = useResolveMaintenanceRequest();
  const closeMutation = useCloseMaintenanceRequest();
  const cancelMutation = useCancelMaintenanceRequest();
  const rejectMutation = useRejectMaintenanceRequest();
  const commentMutation = useAddMaintenanceComment();

  // ── Modals State ──────────────────────────────────────────────────────────
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [viewingRequestId, setViewingRequestId] = useState<string | null>(null);

  // Workflow Dialogs inside detail or standalone
  const [assigningTechId, setAssigningTechId] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionCost, setResolutionCost] = useState<number | ''>('');
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  const [cancelRejectReason, setCancelRejectReason] = useState('');
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  const [commentInput, setCommentInput] = useState('');

  // ── Detail Query ──────────────────────────────────────────────────────────
  const { data: detailData, isLoading: isDetailLoading } = useMaintenanceRequest(viewingRequestId ?? '');
  const activeRequest = detailData?.data;

  // ── Create Form State ─────────────────────────────────────────────────────
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<MaintenanceCategory>('ELECTRICAL');
  const [formPriority, setFormPriority] = useState<MaintenancePriority>('MEDIUM');
  const [formBuildingId, setFormBuildingId] = useState('');
  const [formFloorId, setFormFloorId] = useState('');
  const [formRoomId, setFormRoomId] = useState('');
  const [formAssetId, setFormAssetId] = useState('');
  const [formImageUrls, setFormImageUrls] = useState<string>('');

  // Dependent Form Selectors: Building -> Floor -> Room -> Asset
  const { data: formFloorsData } = useFloors({ buildingId: formBuildingId || undefined, limit: 100 });
  const formFloors = formFloorsData?.data || [];

  const { data: formRoomsData } = useRooms({
    buildingId: formBuildingId || undefined,
    floorId: formFloorId || undefined,
    limit: 100,
  });
  const formRooms = formRoomsData?.data || [];

  const { data: formAssetsData } = useAssets({
    buildingId: formBuildingId || undefined,
    roomId: formRoomId || undefined,
    limit: 100,
  });
  const formAssets = formAssetsData?.data || [];

  const handleOpenReportModal = () => {
    setFormTitle('');
    setFormDescription('');
    setFormCategory('ELECTRICAL');
    setFormPriority('MEDIUM');
    setFormBuildingId('');
    setFormFloorId('');
    setFormRoomId('');
    setFormAssetId('');
    setFormImageUrls('');
    setIsReportModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDescription.trim()) {
      toast.error('Validation Error', 'Title and description are required.');
      return;
    }

    const images = formImageUrls
      .split('\n')
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    const payload: CreateMaintenanceRequestInput = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      categoryId: formCategory,
      priority: formPriority,
      buildingId: formBuildingId || undefined,
      roomId: formRoomId || undefined,
      assetId: formAssetId || undefined,
      images,
    };

    try {
      await createMutation.mutateAsync(payload);
      toast.success('Issue Reported', 'Your maintenance ticket has been submitted.');
      setIsReportModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit report.';
      toast.error('Submission Failed', msg);
    }
  };

  // ── Workflow Handlers ─────────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!viewingRequestId || !assigningTechId) return;
    try {
      await assignMutation.mutateAsync({ id: viewingRequestId, data: { technicianId: assigningTechId } });
      toast.success('Technician Assigned', 'Work ticket status is now ASSIGNED.');
      setIsAssignModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Assignment failed.';
      toast.error('Assignment Failed', msg);
    }
  };

  const handleStartWork = async () => {
    if (!viewingRequestId) return;
    try {
      await startMutation.mutateAsync(viewingRequestId);
      toast.success('Work Started', 'Ticket status changed to IN_PROGRESS.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not start work.';
      toast.error('Action Failed', msg);
    }
  };

  const handleResolve = async () => {
    if (!viewingRequestId || !resolutionNotes.trim()) {
      toast.error('Validation Error', 'Resolution notes are required.');
      return;
    }
    try {
      await resolveMutation.mutateAsync({
        id: viewingRequestId,
        data: {
          resolutionNotes: resolutionNotes.trim(),
          cost: resolutionCost !== '' ? Number(resolutionCost) : null,
        },
      });
      toast.success('Ticket Resolved', 'Marked as RESOLVED and updated asset history.');
      setIsResolveModalOpen(false);
      setResolutionNotes('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Resolution failed.';
      toast.error('Action Failed', msg);
    }
  };

  const handleClose = async () => {
    if (!viewingRequestId) return;
    try {
      await closeMutation.mutateAsync({ id: viewingRequestId, data: {} });
      toast.success('Ticket Closed', 'Maintenance work order officially completed.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not close ticket.';
      toast.error('Action Failed', msg);
    }
  };

  const handleCancel = async () => {
    if (!viewingRequestId || !cancelRejectReason.trim()) {
      toast.error('Validation Error', 'Please provide a cancellation reason.');
      return;
    }
    try {
      await cancelMutation.mutateAsync({
        id: viewingRequestId,
        data: { reason: cancelRejectReason.trim() },
      });
      toast.success('Ticket Cancelled', 'Request has been cancelled.');
      setIsCancelModalOpen(false);
      setCancelRejectReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cancellation failed.';
      toast.error('Action Failed', msg);
    }
  };

  const handleReject = async () => {
    if (!viewingRequestId || !cancelRejectReason.trim()) {
      toast.error('Validation Error', 'Please provide a rejection reason.');
      return;
    }
    try {
      await rejectMutation.mutateAsync({
        id: viewingRequestId,
        data: { reason: cancelRejectReason.trim() },
      });
      toast.success('Ticket Rejected', 'Request marked as REJECTED.');
      setIsRejectModalOpen(false);
      setCancelRejectReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rejection failed.';
      toast.error('Action Failed', msg);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingRequestId || !commentInput.trim()) return;
    try {
      await commentMutation.mutateAsync({
        id: viewingRequestId,
        data: { content: commentInput.trim() },
      });
      setCommentInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to post comment.';
      toast.error('Error', msg);
    }
  };

  // ── Badges ────────────────────────────────────────────────────────────────
  const getStatusBadge = (status: MaintenanceStatus) => {
    switch (status) {
      case 'REPORTED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">REPORTED</span>;
      case 'ASSIGNED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">ASSIGNED</span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">IN PROGRESS</span>;
      case 'RESOLVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">RESOLVED</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">CLOSED</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">REJECTED</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">CANCELLED</span>;
    }
  };

  const getPriorityBadge = (priority: MaintenancePriority) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">LOW</span>;
    }
  };

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns: Column<MaintenanceRequest>[] = [
    {
      header: 'Issue / Details',
      cell: (row) => (
        <div className="flex items-start space-x-3 max-w-xs">
          <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-amber-400 shrink-0 mt-0.5">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm line-clamp-1">{row.title}</div>
            <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">{row.description}</div>
            <div className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-wider">
              {row.categoryId || 'GENERAL'} &bull; By: {row.reporter?.firstName} {row.reporter?.lastName}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Priority',
      cell: (row) => getPriorityBadge(row.priority),
    },
    {
      header: 'Status',
      cell: (row) => getStatusBadge(row.status),
    },
    {
      header: 'Location / Asset',
      cell: (row) => {
        const roomNum = row.room?.roomNumber;
        const bld = row.room?.floor?.building?.name;
        const assetTag = row.asset?.assetTag;

        return (
          <div className="text-xs space-y-1">
            {roomNum ? (
              <div className="text-slate-200 flex items-center space-x-1">
                <DoorOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Room {roomNum} ({bld})</span>
              </div>
            ) : (
              <div className="text-slate-500 italic">Facility Wide</div>
            )}
            {assetTag && (
              <div className="text-amber-400 font-mono text-[11px] flex items-center space-x-1">
                <Boxes className="w-3 h-3 shrink-0" />
                <span>{assetTag}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Assigned Tech',
      cell: (row) => {
        const tech = row.assignments?.[0]?.technician;
        if (!tech) return <span className="text-xs text-slate-500 italic">Unassigned</span>;
        return (
          <div className="text-xs text-slate-300 flex items-center space-x-1.5">
            <UserCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>{tech.firstName} {tech.lastName}</span>
          </div>
        );
      },
    },
    {
      header: 'Reported',
      cell: (row) => (
        <div className="text-xs text-slate-400 flex items-center space-x-1">
          <Calendar className="w-3 h-3 text-slate-500" />
          <span>{formatDate(row.createdAt)}</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <button
          onClick={() => setViewingRequestId(row.id)}
          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-amber-300 hover:bg-amber-950/30 transition-colors"
          title="Open Ticket View & Actions"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <Breadcrumb />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Wrench className="w-8 h-8 text-amber-400" />
            Maintenance Operations
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Dispatch, track repairs, log resolution history, and manage campus facilities lifecycle.
          </p>
        </div>

        <button
          id="report-issue-btn"
          onClick={handleOpenReportModal}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Report New Issue</span>
        </button>
      </div>

      {/* Metric KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard title="Total Tickets" value={metrics.total} icon={Wrench} variant="default" />
          <KpiCard title="Reported" value={metrics.reported} icon={AlertTriangle} variant="info" />
          <KpiCard title="Assigned" value={metrics.assigned} icon={UserCheck} variant="default" />
          <KpiCard title="In Progress" value={metrics.inProgress} icon={Clock} variant="warning" />
          <KpiCard title="Resolved" value={metrics.resolved} icon={CheckCircle2} variant="info" />
          <KpiCard title="Critical Open" value={metrics.critical} icon={AlertTriangle} variant="danger" />
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5 text-amber-400" />
          <span>Filters &amp; Search</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value as MaintenanceStatus | '');
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Statuses</option>
            {STATUS_LIST.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => {
              setSelectedPriority(e.target.value as MaintenancePriority | '');
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Priorities</option>
            {PRIORITY_LIST.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value as MaintenanceCategory | '');
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Categories</option>
            {CATEGORY_LIST.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={selectedBuilding}
            onChange={(e) => {
              setSelectedBuilding(e.target.value);
              setSelectedRoom('');
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Buildings</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select
            value={selectedRoom}
            onChange={(e) => {
              setSelectedRoom(e.target.value);
              setPage(1);
            }}
            disabled={!selectedBuilding}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Rooms</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>Room {r.roomNumber}</option>
            ))}
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search tickets..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-sm">
          Failed to load maintenance records.
        </div>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={requests}
        isLoading={isLoading}
        pagination={
          pagination
            ? {
                page: pagination.page,
                limit: pagination.limit,
                total: pagination.total,
                totalPages: pagination.totalPages,
                onPageChange: (p) => setPage(p),
              }
            : undefined
        }
        emptyTitle="No Maintenance Tickets"
        emptyDescription="No tickets match your filter criteria."
      />

      {/* ── Report Issue Modal ────────────────────────────────────────────── */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Report Maintenance Issue"
        subtitle="Submit facility or equipment repair request"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Issue Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Projector power failure in Lecture Hall A"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Category <span className="text-rose-400">*</span>
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as MaintenanceCategory)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              >
                {CATEGORY_LIST.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Priority <span className="text-rose-400">*</span>
              </label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as MaintenancePriority)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              >
                {PRIORITY_LIST.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Location & Asset Cascading Selectors */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
              <BuildingIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Location &amp; Asset Association</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Building</label>
                <select
                  value={formBuildingId}
                  onChange={(e) => {
                    setFormBuildingId(e.target.value);
                    setFormFloorId('');
                    setFormRoomId('');
                    setFormAssetId('');
                  }}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Select Building</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Floor Level</label>
                <select
                  value={formFloorId}
                  onChange={(e) => {
                    setFormFloorId(e.target.value);
                    setFormRoomId('');
                    setFormAssetId('');
                  }}
                  disabled={!formBuildingId}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Any Floor</option>
                  {formFloors.map((f) => (
                    <option key={f.id} value={f.id}>Level {f.level}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Room</label>
                <select
                  value={formRoomId}
                  onChange={(e) => {
                    setFormRoomId(e.target.value);
                    setFormAssetId('');
                  }}
                  disabled={!formBuildingId}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Select Room</option>
                  {formRooms.map((r) => (
                    <option key={r.id} value={r.id}>Room {r.roomNumber}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Related Asset (Optional)</label>
              <select
                value={formAssetId}
                onChange={(e) => setFormAssetId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">None (Facility-wide)</option>
                {formAssets.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.assetTag})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Issue Description <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Describe symptoms, exact location, or observed malfunction in detail..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Image URLs (Optional, one per line)
            </label>
            <textarea
              rows={2}
              value={formImageUrls}
              onChange={(e) => setFormImageUrls(e.target.value)}
              placeholder="https://example.com/photo1.jpg"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold disabled:opacity-50"
            >
              {createMutation.isPending ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View Detail & Lifecycle Management Modal ──────────────────────── */}
      <Modal
        isOpen={Boolean(viewingRequestId)}
        onClose={() => setViewingRequestId(null)}
        title="Maintenance Ticket Lifecycle"
        subtitle={activeRequest ? `Ticket: ${activeRequest.title}` : 'Loading...'}
        maxWidth="2xl"
      >
        {isDetailLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          </div>
        ) : activeRequest ? (
          <div className="space-y-6">
            {/* Status & Action Bar */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(activeRequest.status)}
                  {getPriorityBadge(activeRequest.priority)}
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  Reported by <strong className="text-white">{activeRequest.reporter?.firstName} {activeRequest.reporter?.lastName}</strong> ({activeRequest.reporter?.email}) &bull; {formatDate(activeRequest.createdAt)}
                </div>
              </div>

              {/* Lifecycle Transitions Buttons */}
              <div className="flex flex-wrap gap-2">
                {/* Assign Button */}
                {canAssign && ['REPORTED', 'ASSIGNED'].includes(activeRequest.status) && (
                  <button
                    onClick={() => {
                      setAssigningTechId(activeRequest.assignments?.[0]?.technicianId || '');
                      setIsAssignModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{activeRequest.status === 'ASSIGNED' ? 'Reassign' : 'Assign Tech'}</span>
                  </button>
                )}

                {/* Start Work */}
                {isStaffOrAdmin && ['ASSIGNED', 'REPORTED'].includes(activeRequest.status) && (
                  <button
                    onClick={handleStartWork}
                    disabled={startMutation.isPending}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Start Work</span>
                  </button>
                )}

                {/* Resolve */}
                {isStaffOrAdmin && ['IN_PROGRESS', 'ASSIGNED'].includes(activeRequest.status) && (
                  <button
                    onClick={() => setIsResolveModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark Resolved</span>
                  </button>
                )}

                {/* Close */}
                {canClose && activeRequest.status === 'RESOLVED' && (
                  <button
                    onClick={handleClose}
                    disabled={closeMutation.isPending}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Close Ticket</span>
                  </button>
                )}

                {/* Cancel */}
                {(user?.id === activeRequest.reporterId || isStaffOrAdmin) &&
                  !['CLOSED', 'RESOLVED', 'CANCELLED', 'REJECTED'].includes(activeRequest.status) && (
                    <button
                      onClick={() => setIsCancelModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-rose-400 hover:bg-rose-950/40 text-xs font-medium flex items-center space-x-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}

                {/* Reject */}
                {canAssign && ['REPORTED', 'ASSIGNED'].includes(activeRequest.status) && (
                  <button
                    onClick={() => setIsRejectModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-rose-400 hover:bg-rose-950/40 text-xs font-medium flex items-center space-x-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                )}
              </div>
            </div>

            {/* Description & Location details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <p className="text-slate-500 uppercase tracking-wider font-semibold">Description</p>
                <p className="text-slate-200 leading-relaxed">{activeRequest.description}</p>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <p className="text-slate-500 uppercase tracking-wider font-semibold">Location &amp; Equipment</p>
                <div className="text-slate-300 space-y-1">
                  <div>
                    <strong className="text-white">Location:</strong>{' '}
                    {activeRequest.room
                      ? `Room ${activeRequest.room.roomNumber} (${activeRequest.room.floor?.building?.name}, Level ${activeRequest.room.floor?.level})`
                      : 'Campus-wide / Unassigned'}
                  </div>
                  {activeRequest.asset && (
                    <div className="text-amber-400 font-mono">
                      <strong className="text-white font-sans">Asset:</strong> {activeRequest.asset.name} ({activeRequest.asset.assetTag})
                    </div>
                  )}
                  {activeRequest.assignments?.[0]?.technician && (
                    <div className="text-indigo-400">
                      <strong className="text-white">Assigned Technician:</strong>{' '}
                      {activeRequest.assignments[0].technician.firstName} {activeRequest.assignments[0].technician.lastName}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Images */}
            {activeRequest.images && activeRequest.images.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400 font-semibold flex items-center space-x-1.5 uppercase tracking-wider">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Attached Photo Evidence</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeRequest.images.map((img, idx) => (
                    <a
                      key={idx}
                      href={img}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-amber-400 hover:underline max-w-xs truncate"
                    >
                      Image #{idx + 1}: {img}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Comments & Activity Stream */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <p className="text-xs text-slate-400 font-semibold flex items-center space-x-1.5 uppercase tracking-wider">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Ticket Discussion &amp; Work Notes</span>
              </p>

              <div className="max-h-56 overflow-y-auto space-y-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
                {activeRequest.comments && activeRequest.comments.length > 0 ? (
                  activeRequest.comments.map((c) => (
                    <div key={c.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-xs">
                      <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                        <strong className="text-white">
                          {c.author ? `${c.author.firstName} ${c.author.lastName}` : 'System / Staff'}
                        </strong>
                        <span>{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-slate-200 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-2">No comments yet.</p>
                )}
              </div>

              {/* Add Comment Input */}
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Post progress update or technician note..."
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  disabled={commentMutation.isPending || !commentInput.trim()}
                  className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Ticket not found.</p>
        )}
      </Modal>

      {/* ── Assign Technician Sub-Modal ──────────────────────────────────── */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Maintenance Technician"
        maxWidth="md"
      >
        <div className="space-y-4">
          <label className="block text-xs font-medium text-slate-300">Select Technician</label>
          <select
            value={assigningTechId}
            onChange={(e) => setAssigningTechId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="" disabled>Choose Staff Member</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.email})</option>
            ))}
          </select>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={() => setIsAssignModalOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={assignMutation.isPending || !assigningTechId}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50"
            >
              {assignMutation.isPending ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Resolve Ticket Sub-Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        title="Record Ticket Resolution"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Resolution Notes <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Detail actions performed, replaced parts, or testing conducted..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Repair Cost ($ Optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={resolutionCost}
              onChange={(e) => setResolutionCost(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={() => setIsResolveModalOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleResolve}
              disabled={resolveMutation.isPending || !resolutionNotes.trim()}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50"
            >
              {resolveMutation.isPending ? 'Resolving...' : 'Confirm Resolution'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Cancel / Reject Sub-Modal ────────────────────────────────────── */}
      <Modal
        isOpen={isCancelModalOpen || isRejectModalOpen}
        onClose={() => {
          setIsCancelModalOpen(false);
          setIsRejectModalOpen(false);
        }}
        title={isCancelModalOpen ? 'Cancel Maintenance Request' : 'Reject Maintenance Request'}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Reason <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              value={cancelRejectReason}
              onChange={(e) => setCancelRejectReason(e.target.value)}
              placeholder="Provide justification..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={() => {
                setIsCancelModalOpen(false);
                setIsRejectModalOpen(false);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 text-xs"
            >
              Cancel
            </button>
            <button
              onClick={isCancelModalOpen ? handleCancel : handleReject}
              disabled={cancelMutation.isPending || rejectMutation.isPending || !cancelRejectReason.trim()}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-50"
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
