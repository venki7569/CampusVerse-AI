import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Archive,
  Search,
  Filter,
  Eye,
  MapPin,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  useBuildings,
  useBuilding,
  useCreateBuilding,
  useUpdateBuilding,
  useArchiveBuilding,
} from '../hooks/useBuildings';
import { useAuth } from '../store/authContext';
import { useToast } from '../components/ui/Toast';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import type {
  Building,
  CreateBuildingInput,
  UpdateBuildingInput,
  OperationalStatus,
  BuildingQueryParams,
} from '../types';

const OPERATIONAL_STATUSES: OperationalStatus[] = [
  'ACTIVE',
  'INACTIVE',
  'UNDER_MAINTENANCE',
  'DAMAGED',
  'RETIRED',
];

export function Buildings() {
  const { hasAnyRole } = useAuth();
  const toast = useToast();

  // RBAC
  const canCreate = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN']);
  const canEdit = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN']);
  const canArchive = hasAnyRole(['SUPER_ADMIN']);

  // ── Filter & Pagination state ──────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OperationalStatus | ''>('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const queryParams: BuildingQueryParams = {
    page,
    limit,
    search: search || undefined,
    sortBy: 'name',
    sortOrder: 'asc',
  };

  const { data: buildingsData, isLoading, isError } = useBuildings(queryParams);
  const allBuildings = buildingsData?.data ?? [];
  // Filter by status client-side (API pagination + status filter via query params would require
  // backend support; the buildings list endpoint supports search but not status filter param,
  // so we apply status client-side for a seamless experience).
  const buildings = selectedStatus
    ? allBuildings.filter((b) => b.operationalStatus === selectedStatus)
    : allBuildings;
  const pagination = buildingsData?.meta.pagination;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useCreateBuilding();
  const updateMutation = useUpdateBuilding();
  const archiveMutation = useArchiveBuilding();

  // ── Modal state ───────────────────────────────────────────────────────────
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [viewingBuildingId, setViewingBuildingId] = useState<string | null>(null);
  const [archivingBuilding, setArchivingBuilding] = useState<Building | null>(null);

  const { data: viewingBldData, isLoading: isViewLoading } = useBuilding(viewingBuildingId ?? '');
  const viewingBuilding = viewingBldData?.data;

  // ── Form inputs ───────────────────────────────────────────────────────────
  const [codeInput, setCodeInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [coordinatesInput, setCoordinatesInput] = useState('');
  const [statusInput, setStatusInput] = useState<OperationalStatus>('ACTIVE');

  const openCreateModal = () => {
    setEditingBuilding(null);
    setCodeInput('');
    setNameInput('');
    setLocationInput('');
    setCoordinatesInput('');
    setStatusInput('ACTIVE');
    setIsFormOpen(true);
  };

  const openEditModal = (bld: Building) => {
    setEditingBuilding(bld);
    setCodeInput(bld.code);
    setNameInput(bld.name);
    setLocationInput(bld.location ?? '');
    setCoordinatesInput(bld.coordinates ?? '');
    setStatusInput(bld.operationalStatus);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nameInput.trim()) {
      toast.error('Validation Error', 'Building name is required.');
      return;
    }
    if (!editingBuilding && !codeInput.trim()) {
      toast.error('Validation Error', 'Building code is required.');
      return;
    }

    try {
      if (editingBuilding) {
        const payload: UpdateBuildingInput = {
          name: nameInput.trim(),
          location: locationInput.trim() || undefined,
          coordinates: coordinatesInput.trim() || undefined,
          operationalStatus: statusInput,
        };
        await updateMutation.mutateAsync({ id: editingBuilding.id, data: payload });
        toast.success('Building Updated', `"${nameInput}" was successfully updated.`);
      } else {
        const payload: CreateBuildingInput = {
          code: codeInput.trim().toUpperCase(),
          name: nameInput.trim(),
          location: locationInput.trim() || undefined,
          coordinates: coordinatesInput.trim() || undefined,
          operationalStatus: statusInput,
        };
        await createMutation.mutateAsync(payload);
        toast.success('Building Created', `Building "${nameInput}" (${codeInput.toUpperCase()}) has been created.`);
      }
      setIsFormOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save building.';
      toast.error('Operation Failed', msg);
    }
  };

  const handleArchive = async () => {
    if (!archivingBuilding) return;
    try {
      await archiveMutation.mutateAsync(archivingBuilding.id);
      toast.success('Building Archived', `"${archivingBuilding.name}" has been set to RETIRED status.`);
      setArchivingBuilding(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to archive building.';
      toast.error('Archive Failed', msg);
    }
  };

  // ── Badge helpers ─────────────────────────────────────────────────────────
  const getStatusBadge = (status: OperationalStatus) => {
    const map: Record<OperationalStatus, { bg: string; text: string; label: string }> = {
      ACTIVE: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: 'ACTIVE' },
      INACTIVE: { bg: 'bg-slate-700/50 border-slate-600/30', text: 'text-slate-400', label: 'INACTIVE' },
      UNDER_MAINTENANCE: { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400', label: 'MAINTENANCE' },
      DAMAGED: { bg: 'bg-orange-500/10 border-orange-500/20', text: 'text-orange-400', label: 'DAMAGED' },
      RETIRED: { bg: 'bg-rose-500/10 border-rose-500/20', text: 'text-rose-400', label: 'RETIRED' },
    };
    const s = map[status] ?? map['INACTIVE'];
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: Column<Building>[] = [
    {
      header: 'Building',
      cell: (row) => (
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-violet-400">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-white text-sm">{row.name}</span>
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{row.code}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Location',
      cell: (row) => (
        <div className="flex items-center space-x-1.5 text-slate-300 text-xs">
          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="max-w-[160px] truncate">{row.location ?? '—'}</span>
        </div>
      ),
    },
    {
      header: 'Floors',
      cell: (row) => (
        <div className="flex items-center space-x-1.5 text-slate-300 text-xs">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span>{row._count?.floors ?? '—'}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => getStatusBadge(row.operationalStatus),
    },
    {
      header: 'Created',
      cell: (row) => (
        <div className="flex items-center space-x-1.5 text-xs text-slate-400">
          <Calendar className="w-3 h-3 text-slate-500" />
          <span>{formatDate(row.createdAt)}</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center space-x-2">
          {/* View */}
          <button
            onClick={() => setViewingBuildingId(row.id)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-violet-300 hover:bg-violet-950/30 transition-colors"
            title="View Building"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {/* Edit */}
          {canEdit && (
            <button
              onClick={() => openEditModal(row)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Edit Building"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Archive */}
          {canArchive && row.operationalStatus !== 'RETIRED' && (
            <button
              onClick={() => setArchivingBuilding(row)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
              title="Archive Building"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <Breadcrumb />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Building2 className="w-8 h-8 text-violet-400" />
            Buildings
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage campus buildings, locations, floor counts, and operational statuses.
          </p>
        </div>

        {canCreate && (
          <button
            id="add-building-btn"
            onClick={openCreateModal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Building</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5 text-violet-400" />
          <span>Filters &amp; Search</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* Status Filter */}
          <select
            id="building-status-filter"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value as OperationalStatus | '');
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">All Statuses</option>
            {OPERATIONAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative md:col-span-2">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              id="building-search"
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, code, or location…"
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-sm">
          Failed to load buildings. Please check your permissions or network connection.
        </div>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={buildings}
        isLoading={isLoading}
        pagination={
          pagination && !selectedStatus
            ? {
                page: pagination.page,
                limit: pagination.limit,
                total: pagination.total,
                totalPages: pagination.totalPages,
                onPageChange: (p) => setPage(p),
              }
            : undefined
        }
        emptyTitle="No Buildings Found"
        emptyDescription="No buildings match your current filters. Try adjusting your search or status filter."
      />

      {/* ── Create / Edit Modal ───────────────────────────────────────────── */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingBuilding ? 'Edit Building' : 'Add New Building'}
        subtitle={
          editingBuilding
            ? `Update details for ${editingBuilding.name} (${editingBuilding.code})`
            : 'Register a new campus building'
        }
        maxWidth="lg"
      >
        <form id="building-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Code — read-only on edit */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Building Code <span className="text-rose-400">*</span>
              </label>
              <input
                id="building-code-input"
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                disabled={Boolean(editingBuilding)}
                placeholder="e.g. BLK-A"
                maxLength={20}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono uppercase"
                required={!editingBuilding}
              />
              {editingBuilding && (
                <p className="text-[10px] text-slate-500 mt-1">Code cannot be changed after creation.</p>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Building Name <span className="text-rose-400">*</span>
              </label>
              <input
                id="building-name-input"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Science & Technology Block"
                maxLength={100}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                required
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Location / Address <span className="text-slate-500">(optional)</span>
            </label>
            <input
              id="building-location-input"
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="e.g. North Campus, Main Road"
              maxLength={200}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Coordinates */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Coordinates <span className="text-slate-500">(optional, e.g. 12.9716,77.5946)</span>
            </label>
            <input
              id="building-coordinates-input"
              type="text"
              value={coordinatesInput}
              onChange={(e) => setCoordinatesInput(e.target.value)}
              placeholder="lat,lng"
              maxLength={100}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
            />
          </div>

          {/* Operational Status */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Operational Status <span className="text-rose-400">*</span>
            </label>
            <select
              id="building-status-input"
              value={statusInput}
              onChange={(e) => setStatusInput(e.target.value as OperationalStatus)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="UNDER_MAINTENANCE">Under Maintenance</option>
              <option value="DAMAGED">Damaged</option>
              <option value="RETIRED">Retired</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving…'
                : editingBuilding
                ? 'Update Building'
                : 'Create Building'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View Detail Modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(viewingBuildingId)}
        onClose={() => setViewingBuildingId(null)}
        title="Building Details"
        subtitle="Full information for this building"
        maxWidth="md"
      >
        {isViewLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          </div>
        ) : viewingBuilding ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-violet-400">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">{viewingBuilding.name}</h4>
                <span className="text-xs font-mono text-slate-400 uppercase">{viewingBuilding.code}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-slate-500 uppercase tracking-wider mb-1">Status</p>
                {getStatusBadge(viewingBuilding.operationalStatus)}
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-slate-500 uppercase tracking-wider mb-1">Floors</p>
                <span className="text-white font-semibold">{viewingBuilding._count?.floors ?? (viewingBuilding.floors?.length ?? '—')}</span>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 col-span-2">
                <p className="text-slate-500 uppercase tracking-wider mb-1">Location</p>
                <span className="text-slate-200">{viewingBuilding.location ?? '—'}</span>
              </div>
              {viewingBuilding.coordinates && (
                <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 col-span-2">
                  <p className="text-slate-500 uppercase tracking-wider mb-1">Coordinates</p>
                  <span className="text-slate-200 font-mono text-xs">{viewingBuilding.coordinates}</span>
                </div>
              )}
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-slate-500 uppercase tracking-wider mb-1">Created</p>
                <span className="text-slate-200">{formatDate(viewingBuilding.createdAt)}</span>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-slate-500 uppercase tracking-wider mb-1">Last Updated</p>
                <span className="text-slate-200">{formatDate(viewingBuilding.updatedAt)}</span>
              </div>
            </div>

            {canEdit && (
              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button
                  onClick={() => {
                    setViewingBuildingId(null);
                    openEditModal(viewingBuilding);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Building</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Building not found.</p>
        )}
      </Modal>

      {/* ── Archive Confirmation Modal ────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(archivingBuilding)}
        onClose={() => setArchivingBuilding(null)}
        title="Confirm Building Archival"
        subtitle="This action sets the building status to RETIRED."
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to archive{' '}
            <strong className="text-white">{archivingBuilding?.name}</strong>? The building will be
            marked as RETIRED. All associated floors and rooms remain intact but the building will
            no longer appear as active.
          </p>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setArchivingBuilding(null)}
              className="px-4 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiveMutation.isPending}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              {archiveMutation.isPending ? 'Archiving…' : 'Confirm Archive'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
