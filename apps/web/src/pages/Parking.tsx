import { useMemo, useState } from 'react';
import {
  Car,
  Plus,
  Edit2,
  Eye,
  PowerOff,
  Search,
  ParkingCircle,
  UserPlus,
  Unlock,
  Archive,
} from 'lucide-react';
import {
  useParkingAreas,
  useParkingSlots,
  useParkingAvailability,
  useCreateParkingArea,
  useUpdateParkingArea,
  useArchiveParkingArea,
  useCreateParkingSlot,
  useUpdateParkingSlot,
  useArchiveParkingSlot,
  useAllocateParkingSlot,
  useReleaseParkingSlot,
} from '../hooks/useParking';
import { useBuildings } from '../hooks/useBuildings';
import { useAdminUsers } from '../hooks/useAdmin';
import { useAuth } from '../store/authContext';
import { useToast } from '../components/ui/Toast';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { ErrorState } from '../components/ui/ErrorState';
import { KpiCard } from '../components/ui/KpiCard';
import type {
  ParkingArea,
  ParkingSlot,
  ParkingSlotStatus,
  ParkingSlotType,
  CreateParkingAreaInput,
  UpdateParkingAreaInput,
  CreateParkingSlotInput,
} from '../types';

type ParkingTab = 'areas' | 'slots';

const SLOT_TYPES: ParkingSlotType[] = ['STANDARD', 'HANDICAP', 'EV', 'MOTORCYCLE', 'VISITOR'];
const SLOT_STATUSES: ParkingSlotStatus[] = [
  'AVAILABLE',
  'OCCUPIED',
  'RESERVED',
  'UNDER_MAINTENANCE',
];

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    AVAILABLE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    OCCUPIED: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    RESERVED: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    UNDER_MAINTENANCE: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[status] ?? styles.AVAILABLE}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function Parking() {
  const { hasAnyRole } = useAuth();
  const toast = useToast();

  const canCreate = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN']);
  const canUpdate = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN', 'MAINTENANCE_STAFF']);
  const canDelete = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN']);
  const canAllocate = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN', 'SECURITY_STAFF']);
  const canListUsers = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN']);

  const [tab, setTab] = useState<ParkingTab>('areas');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ParkingSlotStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<ParkingSlotType | ''>('');
  const [activeOnly, setActiveOnly] = useState(false);

  const [isAreaFormOpen, setIsAreaFormOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<ParkingArea | null>(null);
  const [viewingArea, setViewingArea] = useState<ParkingArea | null>(null);
  const [isSlotFormOpen, setIsSlotFormOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ParkingSlot | null>(null);
  const [allocatingSlot, setAllocatingSlot] = useState<ParkingSlot | null>(null);
  const [releaseSlot, setReleaseSlot] = useState<ParkingSlot | null>(null);

  const [areaName, setAreaName] = useState('');
  const [areaLocation, setAreaLocation] = useState('');
  const [areaBuildingId, setAreaBuildingId] = useState('');
  const [slotNumber, setSlotNumber] = useState('');
  const [slotAreaId, setSlotAreaId] = useState('');
  const [slotType, setSlotType] = useState<ParkingSlotType>('STANDARD');
  const [allocateUserId, setAllocateUserId] = useState('');
  const [allocateStatus, setAllocateStatus] = useState<'OCCUPIED' | 'RESERVED'>('OCCUPIED');

  const areaParams = useMemo(
    () => ({
      page,
      limit: 10,
      search: search || undefined,
      buildingId: buildingId || undefined,
      isActive: activeOnly ? true : undefined,
      sortBy: 'name',
      sortOrder: 'asc' as const,
    }),
    [page, search, buildingId, activeOnly],
  );

  const slotParams = useMemo(
    () => ({
      page,
      limit: 10,
      search: search || undefined,
      buildingId: buildingId || undefined,
      areaId: areaFilter || undefined,
      status: statusFilter || undefined,
      slotType: typeFilter || undefined,
      sortBy: 'slotNumber',
      sortOrder: 'asc' as const,
    }),
    [page, search, buildingId, areaFilter, statusFilter, typeFilter],
  );

  const { data: availabilityData, isLoading: metricsLoading } = useParkingAvailability({});
  const {
    data: areasData,
    isLoading: areasLoading,
    isError: areasError,
    refetch: refetchAreas,
  } = useParkingAreas(areaParams);
  const {
    data: slotsData,
    isLoading: slotsLoading,
    isError: slotsError,
    refetch: refetchSlots,
  } = useParkingSlots(slotParams);
  const { data: buildingsData } = useBuildings({ page: 1, limit: 100, sortBy: 'name' });
  const { data: allAreasData } = useParkingAreas({ page: 1, limit: 100, sortBy: 'name' });
  const { data: usersData } = useAdminUsers(
    { page: 1, limit: 100, status: 'ACTIVE', sortBy: 'firstName' },
    { enabled: canListUsers },
  );

  const createArea = useCreateParkingArea();
  const updateArea = useUpdateParkingArea();
  const archiveArea = useArchiveParkingArea();
  const createSlot = useCreateParkingSlot();
  const updateSlot = useUpdateParkingSlot();
  const archiveSlot = useArchiveParkingSlot();
  const allocateSlot = useAllocateParkingSlot();
  const releaseMutation = useReleaseParkingSlot();

  const metrics = availabilityData?.data;
  const areas = areasData?.data ?? [];
  const slots = slotsData?.data ?? [];
  const buildings = buildingsData?.data ?? [];
  const allAreas = allAreasData?.data ?? [];
  const users = usersData?.data ?? [];
  const areaPagination = areasData?.meta.pagination;
  const slotPagination = slotsData?.meta.pagination;

  const openCreateArea = () => {
    setEditingArea(null);
    setAreaName('');
    setAreaLocation('');
    setAreaBuildingId('');
    setIsAreaFormOpen(true);
  };

  const openEditArea = (area: ParkingArea) => {
    setEditingArea(area);
    setAreaName(area.name);
    setAreaLocation(area.location ?? '');
    setAreaBuildingId(area.buildingId ?? '');
    setIsAreaFormOpen(true);
  };

  const openCreateSlot = () => {
    setEditingSlot(null);
    setSlotNumber('');
    setSlotAreaId(areaFilter || allAreas[0]?.id || '');
    setSlotType('STANDARD');
    setIsSlotFormOpen(true);
  };

  const openEditSlot = (slot: ParkingSlot) => {
    setEditingSlot(slot);
    setSlotNumber(slot.slotNumber);
    setSlotAreaId(slot.areaId);
    setSlotType((slot.slotType as ParkingSlotType) || 'STANDARD');
    setIsSlotFormOpen(true);
  };

  const handleSaveArea = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingArea) {
        const payload: UpdateParkingAreaInput = {
          name: areaName.trim(),
          location: areaLocation.trim() || null,
          buildingId: areaBuildingId || null,
        };
        await updateArea.mutateAsync({ id: editingArea.id, data: payload });
        toast.success('Area updated', areaName);
      } else {
        const payload: CreateParkingAreaInput = {
          name: areaName.trim(),
          location: areaLocation.trim() || null,
          buildingId: areaBuildingId || null,
          isActive: true,
        };
        await createArea.mutateAsync(payload);
        toast.success('Area created', areaName);
      }
      setIsAreaFormOpen(false);
    } catch (err: unknown) {
      toast.error('Save failed', err instanceof Error ? err.message : 'Could not save parking area');
    }
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSlot) {
        await updateSlot.mutateAsync({
          id: editingSlot.id,
          data: { slotNumber: slotNumber.trim(), slotType },
        });
        toast.success('Slot updated', slotNumber);
      } else {
        const payload: CreateParkingSlotInput = {
          areaId: slotAreaId,
          slotNumber: slotNumber.trim(),
          slotType,
          status: 'AVAILABLE',
        };
        await createSlot.mutateAsync(payload);
        toast.success('Slot created', slotNumber);
      }
      setIsSlotFormOpen(false);
    } catch (err: unknown) {
      toast.error('Save failed', err instanceof Error ? err.message : 'Could not save parking slot');
    }
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingSlot) return;
    try {
      await allocateSlot.mutateAsync({
        id: allocatingSlot.id,
        data: { userId: allocateUserId, status: allocateStatus },
      });
      toast.success('Allocated', `Slot ${allocatingSlot.slotNumber} assigned`);
      setAllocatingSlot(null);
      setAllocateUserId('');
    } catch (err: unknown) {
      toast.error('Allocation failed', err instanceof Error ? err.message : 'Could not allocate');
    }
  };

  const handleRelease = async () => {
    if (!releaseSlot) return;
    try {
      await releaseMutation.mutateAsync(releaseSlot.id);
      toast.success('Released', `Slot ${releaseSlot.slotNumber} is available`);
      setReleaseSlot(null);
    } catch (err: unknown) {
      toast.error('Release failed', err instanceof Error ? err.message : 'Could not release');
    }
  };

  const areaColumns: Column<ParkingArea>[] = [
    {
      header: 'Area',
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">{row.name}</p>
          <p className="text-xs text-slate-400">{row.location ?? 'No location'}</p>
        </div>
      ),
    },
    { header: 'Building', cell: (row) => row.building?.name ?? '—' },
    {
      header: 'Slots',
      cell: (row) => (
        <span className="text-xs">
          {row.slotCounts?.available ?? 0} avail / {row.slotCounts?.total ?? row.totalSlots}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (row) => (
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
            row.isActive
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-slate-700/40 text-slate-300 border-slate-600/40'
          }`}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewingArea(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          {canUpdate && (
            <button
              onClick={() => openEditArea(row)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {canDelete && row.isActive && (
            <button
              onClick={() =>
                void archiveArea
                  .mutateAsync(row.id)
                  .then(() => toast.success('Archived', row.name))
                  .catch((err: unknown) =>
                    toast.error(
                      'Archive failed',
                      err instanceof Error ? err.message : 'Could not archive',
                    ),
                  )
              }
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              title="Deactivate"
            >
              <PowerOff className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const slotColumns: Column<ParkingSlot>[] = [
    {
      header: 'Slot',
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">{row.slotNumber}</p>
          <p className="text-xs text-slate-400">{row.slotType}</p>
        </div>
      ),
    },
    { header: 'Area', cell: (row) => row.area?.name ?? '—' },
    { header: 'Building', cell: (row) => row.area?.building?.name ?? '—' },
    { header: 'Status', cell: (row) => statusBadge(row.status) },
    {
      header: 'Reserved For',
      cell: (row) =>
        row.reservedFor
          ? `${row.reservedFor.firstName} ${row.reservedFor.lastName}`
          : '—',
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-1">
          {canUpdate && (
            <button
              onClick={() => openEditSlot(row)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {canAllocate && row.status === 'AVAILABLE' && row.area?.isActive && (
            <button
              onClick={() => {
                setAllocatingSlot(row);
                setAllocateUserId('');
                setAllocateStatus('OCCUPIED');
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800"
              title="Allocate"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          )}
          {canAllocate && (row.status === 'OCCUPIED' || row.status === 'RESERVED') && (
            <button
              onClick={() => setReleaseSlot(row)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800"
              title="Release"
            >
              <Unlock className="w-4 h-4" />
            </button>
          )}
          {canDelete && row.status === 'AVAILABLE' && (
            <button
              onClick={() =>
                void archiveSlot
                  .mutateAsync(row.id)
                  .then(() => toast.success('Archived', row.slotNumber))
                  .catch((err: unknown) =>
                    toast.error(
                      'Archive failed',
                      err instanceof Error ? err.message : 'Could not archive',
                    ),
                  )
              }
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              title="Archive"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Breadcrumb />
          <h1 className="text-2xl font-bold text-white mt-2 flex items-center gap-2">
            <ParkingCircle className="w-6 h-6 text-emerald-400" />
            Parking Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Areas, slots, allocation, and live campus parking availability.
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'areas' && canCreate && (
            <button
              onClick={openCreateArea}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-sm hover:bg-emerald-400"
            >
              <Plus className="w-4 h-4" />
              Create Area
            </button>
          )}
          {tab === 'slots' && canCreate && (
            <button
              onClick={openCreateSlot}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-sm hover:bg-emerald-400"
            >
              <Plus className="w-4 h-4" />
              Create Slot
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Areas" value={metrics?.areas ?? 0} icon={Car} isLoading={metricsLoading} />
        <KpiCard
          title="Total Slots"
          value={metrics?.totalSlots ?? 0}
          icon={ParkingCircle}
          isLoading={metricsLoading}
        />
        <KpiCard
          title="Available"
          value={metrics?.available ?? 0}
          icon={Car}
          variant="success"
          isLoading={metricsLoading}
        />
        <KpiCard
          title="Occupied"
          value={metrics?.occupied ?? 0}
          icon={Car}
          variant="danger"
          isLoading={metricsLoading}
        />
        <KpiCard
          title="Reserved / Maint."
          value={(metrics?.reserved ?? 0) + (metrics?.underMaintenance ?? 0)}
          icon={Car}
          variant="warning"
          isLoading={metricsLoading}
        />
        <KpiCard
          title="Utilization"
          value={
            metrics?.utilizationPercent === null || metrics?.utilizationPercent === undefined
              ? '—'
              : `${metrics.utilizationPercent}%`
          }
          icon={Car}
          isLoading={metricsLoading}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {(['areas', 'slots'] as ParkingTab[]).map((item) => (
          <button
            key={item}
            onClick={() => {
              setTab(item);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === item
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {item === 'areas' ? 'Parking Areas' : 'Parking Slots'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
          />
        </div>
        <select
          value={buildingId}
          onChange={(e) => {
            setBuildingId(e.target.value);
            setPage(1);
          }}
          className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-white px-3 py-2"
        >
          <option value="">All buildings</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {tab === 'areas' ? (
          <label className="flex items-center gap-2 text-xs text-slate-300 px-2">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => {
                setActiveOnly(e.target.checked);
                setPage(1);
              }}
            />
            Active only
          </label>
        ) : (
          <>
            <select
              value={areaFilter}
              onChange={(e) => {
                setAreaFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-white px-3 py-2"
            >
              <option value="">All areas</option>
              {allAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ParkingSlotStatus | '');
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-white px-3 py-2"
            >
              <option value="">All statuses</option>
              {SLOT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as ParkingSlotType | '');
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-white px-3 py-2"
            >
              <option value="">All types</option>
              {SLOT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {tab === 'areas' &&
        (areasError ? (
          <ErrorState title="Parking areas unavailable" onRetry={() => void refetchAreas()} />
        ) : (
          <DataTable
            columns={areaColumns}
            data={areas}
            isLoading={areasLoading}
            emptyTitle="No parking areas"
            emptyDescription="Create a parking area to begin managing slots."
            pagination={
              areaPagination
                ? {
                    page: areaPagination.page,
                    limit: areaPagination.limit,
                    total: areaPagination.total,
                    totalPages: areaPagination.totalPages,
                    onPageChange: setPage,
                  }
                : undefined
            }
          />
        ))}

      {tab === 'slots' &&
        (slotsError ? (
          <ErrorState title="Parking slots unavailable" onRetry={() => void refetchSlots()} />
        ) : (
          <DataTable
            columns={slotColumns}
            data={slots}
            isLoading={slotsLoading}
            emptyTitle="No parking slots"
            emptyDescription="Create slots under an active parking area."
            pagination={
              slotPagination
                ? {
                    page: slotPagination.page,
                    limit: slotPagination.limit,
                    total: slotPagination.total,
                    totalPages: slotPagination.totalPages,
                    onPageChange: setPage,
                  }
                : undefined
            }
          />
        ))}

      <Modal
        isOpen={isAreaFormOpen}
        onClose={() => setIsAreaFormOpen(false)}
        title={editingArea ? 'Edit parking area' : 'Create parking area'}
      >
        <form onSubmit={(e) => void handleSaveArea(e)} className="space-y-3">
          <input
            value={areaName}
            onChange={(e) => setAreaName(e.target.value)}
            required
            placeholder="Area name"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
          />
          <input
            value={areaLocation}
            onChange={(e) => setAreaLocation(e.target.value)}
            placeholder="Location"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
          />
          <select
            value={areaBuildingId}
            onChange={(e) => setAreaBuildingId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">No building</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-semibold"
          >
            Save area
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={isSlotFormOpen}
        onClose={() => setIsSlotFormOpen(false)}
        title={editingSlot ? 'Edit parking slot' : 'Create parking slot'}
      >
        <form onSubmit={(e) => void handleSaveSlot(e)} className="space-y-3">
          {!editingSlot && (
            <select
              value={slotAreaId}
              onChange={(e) => setSlotAreaId(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Select area</option>
              {allAreas
                .filter((a) => a.isActive)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          )}
          <input
            value={slotNumber}
            onChange={(e) => setSlotNumber(e.target.value)}
            required
            placeholder="Slot number"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
          />
          <select
            value={slotType}
            onChange={(e) => setSlotType(e.target.value as ParkingSlotType)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
          >
            {SLOT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-semibold"
          >
            Save slot
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(viewingArea)}
        onClose={() => setViewingArea(null)}
        title={viewingArea?.name ?? 'Area details'}
        subtitle={viewingArea?.location ?? undefined}
      >
        {viewingArea && (
          <div className="space-y-2 text-sm text-slate-300">
            <p>
              <span className="text-slate-500">Building:</span>{' '}
              {viewingArea.building?.name ?? '—'}
            </p>
            <p>
              <span className="text-slate-500">Total slots:</span> {viewingArea.totalSlots}
            </p>
            <p>
              <span className="text-slate-500">Available:</span>{' '}
              {viewingArea.slotCounts?.available ?? 0}
            </p>
            <p>
              <span className="text-slate-500">Occupied / Reserved:</span>{' '}
              {(viewingArea.slotCounts?.occupied ?? 0) + (viewingArea.slotCounts?.reserved ?? 0)}
            </p>
            <p>
              <span className="text-slate-500">Status:</span>{' '}
              {viewingArea.isActive ? 'Active' : 'Inactive'}
            </p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(allocatingSlot)}
        onClose={() => setAllocatingSlot(null)}
        title="Allocate parking slot"
        subtitle={
          allocatingSlot
            ? `${allocatingSlot.slotNumber} · ${allocatingSlot.area?.name ?? ''}`
            : undefined
        }
      >
        <form onSubmit={(e) => void handleAllocate(e)} className="space-y-3">
          <select
            value={allocateUserId}
            onChange={(e) => setAllocateUserId(e.target.value)}
            required
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">Select user</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} ({u.email})
              </option>
            ))}
          </select>
          <select
            value={allocateStatus}
            onChange={(e) => setAllocateStatus(e.target.value as 'OCCUPIED' | 'RESERVED')}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="OCCUPIED">OCCUPIED</option>
            <option value="RESERVED">RESERVED</option>
          </select>
          {!canListUsers && (
            <p className="text-xs text-amber-400">
              User directory requires admin read permission. Enter via admin users if list is empty.
            </p>
          )}
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-semibold"
          >
            Confirm allocation
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(releaseSlot)}
        onClose={() => setReleaseSlot(null)}
        title="Release allocation"
        subtitle={releaseSlot?.slotNumber}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Release slot {releaseSlot?.slotNumber}? It will return to AVAILABLE.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setReleaseSlot(null)}
              className="flex-1 py-2 rounded-lg bg-slate-800 text-sm text-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleRelease()}
              className="flex-1 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-semibold"
            >
              Release
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
