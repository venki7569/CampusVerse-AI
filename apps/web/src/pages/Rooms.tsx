import React, { useState } from 'react';
import { DoorOpen, Plus, Edit2, Archive, Search, Filter, Layers, Building as BuildingIcon, Users, Building2 } from 'lucide-react';
import { useRooms, useCreateRoom, useUpdateRoom, useArchiveRoom, useUpdateOccupancy } from '../hooks/useRooms';
import { useBuildings } from '../hooks/useBuildings';
import { useFloors } from '../hooks/useFloors';
import { useDepartments } from '../hooks/useDepartments';
import { useAuth } from '../store/authContext';
import { useToast } from '../components/ui/Toast';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import type { Room, CreateRoomInput, UpdateRoomInput, OperationalStatus, RoomOccupancyStatus } from '../types';

interface RoomsProps {
  /** When set, locks the roomType filter and hides the type-selector UI */
  defaultRoomType?: string;
  pageTitle?: string;
  pageSubtitle?: string;
}

export function Rooms({
  defaultRoomType,
  pageTitle = 'Rooms Directory',
  pageSubtitle = 'Manage classrooms, labs, offices, capacity allocations, and operational statuses.',
}: RoomsProps = {}) {
  const { hasAnyRole } = useAuth();
  const toast = useToast();
  const canModify = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN']);
  const canArchive = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN']);
  const canSetOccupancy = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF']);

  // Filters & Pagination State
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  // If a defaultRoomType is provided (e.g. from Classrooms/Laboratories), lock it
  const [selectedRoomType, setSelectedRoomType] = useState<string>(defaultRoomType ?? '');
  const [selectedOccupancy, setSelectedOccupancy] = useState<string>('');
  const [selectedOperational, setSelectedOperational] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const limit = 10;

  // Hierarchical Data Fetching
  const { data: buildingsData, isLoading: isBuildingsLoading } = useBuildings({ limit: 100 });
  const buildings = buildingsData?.data || [];

  const { data: floorsData, isLoading: isFloorsLoading } = useFloors({
    buildingId: selectedBuildingId || undefined,
    limit: 100,
  });
  const floors = floorsData?.data || [];

  const { data: departmentsData } = useDepartments({ limit: 100, sortBy: 'name', sortOrder: 'asc' });
  const departments = departmentsData?.data || [];

  const { data: roomsData, isLoading, isError } = useRooms({
    page,
    limit,
    search: search || undefined,
    buildingId: selectedBuildingId || undefined,
    floorId: selectedFloorId || undefined,
    departmentId: selectedDepartmentId || undefined,
    roomType: selectedRoomType || undefined,
    occupancyStatus: (selectedOccupancy as RoomOccupancyStatus) || undefined,
    operationalStatus: (selectedOperational as OperationalStatus) || undefined,
  });

  const rooms = roomsData?.data || [];
  const pagination = roomsData?.meta.pagination;

  // Mutations
  const createMutation = useCreateRoom();
  const updateMutation = useUpdateRoom();
  const archiveMutation = useArchiveRoom();
  const occupancyMutation = useUpdateOccupancy();

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [archivingRoom, setArchivingRoom] = useState<Room | null>(null);

  // Form Inputs
  const [modalBuildingId, setModalBuildingId] = useState('');
  const [modalFloorId, setModalFloorId] = useState('');
  const [roomNumberInput, setRoomNumberInput] = useState('');
  const [roomTypeInput, setRoomTypeInput] = useState<string>('CLASSROOM');
  const [capacityInput, setCapacityInput] = useState<number>(30);
  const [operationalStatusInput, setOperationalStatusInput] = useState<OperationalStatus>('ACTIVE');
  const [occupancyStatusInput, setOccupancyStatusInput] = useState<RoomOccupancyStatus>('AVAILABLE');
  const [departmentIdInput, setDepartmentIdInput] = useState<string>('');

  // Modal Floor Query (bound to modal's building selector)
  const { data: modalFloorsData } = useFloors({
    buildingId: modalBuildingId || undefined,
    limit: 100,
  });
  const modalFloors = modalFloorsData?.data || [];

  const handleOpenCreateModal = () => {
    setEditingRoom(null);
    setRoomNumberInput('');
    setRoomTypeInput(defaultRoomType ?? 'CLASSROOM');
    setCapacityInput(30);
    setOperationalStatusInput('ACTIVE');
    setOccupancyStatusInput('AVAILABLE');
    setDepartmentIdInput('');
    const initialBld = selectedBuildingId || (buildings[0]?.id || '');
    setModalBuildingId(initialBld);
    setModalFloorId(selectedFloorId || '');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (room: Room) => {
    setEditingRoom(room);
    setRoomNumberInput(room.roomNumber);
    setRoomTypeInput(room.roomType);
    setCapacityInput(room.capacity);
    setOperationalStatusInput(room.operationalStatus);
    setOccupancyStatusInput(room.occupancyStatus);
    setDepartmentIdInput(room.departmentId ?? '');
    setModalBuildingId(room.floor?.buildingId || '');
    setModalFloorId(room.floorId);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumberInput.trim()) {
      toast.error('Validation Error', 'Room code/number is required.');
      return;
    }
    if (!modalFloorId) {
      toast.error('Validation Error', 'Target floor must be selected.');
      return;
    }

    try {
      if (editingRoom) {
        const updatePayload: UpdateRoomInput = {
          roomNumber: roomNumberInput.trim(),
          capacity: capacityInput,
          roomType: roomTypeInput,
          operationalStatus: operationalStatusInput,
          occupancyStatus: occupancyStatusInput,
          departmentId: departmentIdInput || null,
        };
        await updateMutation.mutateAsync({ id: editingRoom.id, data: updatePayload });
        toast.success('Room Updated', `Room ${roomNumberInput} was successfully updated.`);
      } else {
        const createPayload: CreateRoomInput = {
          roomNumber: roomNumberInput.trim(),
          floorId: modalFloorId,
          capacity: capacityInput,
          roomType: roomTypeInput,
          operationalStatus: operationalStatusInput,
          occupancyStatus: occupancyStatusInput,
          departmentId: departmentIdInput || undefined,
        };
        await createMutation.mutateAsync(createPayload);
        toast.success('Room Created', `Room ${roomNumberInput} has been created.`);
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save room details.';
      toast.error('Operation Failed', errorMsg);
    }
  };

  const handleOccupancyChange = async (room: Room, occupancyStatus: RoomOccupancyStatus) => {
    if (occupancyStatus === room.occupancyStatus) return;
    try {
      await occupancyMutation.mutateAsync({
        id: room.id,
        data: { occupancyStatus, source: 'MANUAL' },
      });
      toast.success('Occupancy Updated', `Room ${room.roomNumber} is now ${occupancyStatus}.`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update occupancy.';
      toast.error('Occupancy Update Failed', errorMsg);
    }
  };

  const handleArchive = async () => {
    if (!archivingRoom) return;
    try {
      await archiveMutation.mutateAsync(archivingRoom.id);
      toast.success('Room Archived', `Room ${archivingRoom.roomNumber} set to RETIRED status.`);
      setArchivingRoom(null);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to archive room.';
      toast.error('Archive Failed', errorMsg);
    }
  };

  const getOccupancyBadge = (status: RoomOccupancyStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">AVAILABLE</span>;
      case 'OCCUPIED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">OCCUPIED</span>;
      case 'RESERVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">RESERVED</span>;
      case 'UNDER_MAINTENANCE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">MAINTENANCE</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  const getOperationalBadge = (status: OperationalStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="text-[10px] uppercase font-bold text-emerald-400">ACTIVE</span>;
      case 'INACTIVE':
        return <span className="text-[10px] uppercase font-bold text-slate-400">INACTIVE</span>;
      case 'RETIRED':
        return <span className="text-[10px] uppercase font-bold text-rose-400">RETIRED</span>;
      case 'UNDER_MAINTENANCE':
        return <span className="text-[10px] uppercase font-bold text-amber-400">MAINTENANCE</span>;
      default:
        return <span className="text-[10px] uppercase font-bold text-slate-400">{status}</span>;
    }
  };

  const columns: Column<Room>[] = [
    {
      header: 'Room Number',
      cell: (row) => (
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-emerald-400">
            <DoorOpen className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-white text-sm">{row.roomNumber}</span>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{row.roomType}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Building & Floor',
      cell: (row) => (
        <div className="text-slate-300 space-y-0.5">
          <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-200">
            <BuildingIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>{row.floor?.building?.name || row.floor?.building?.code || 'N/A'}</span>
          </div>
          <div className="flex items-center space-x-1 text-[11px] text-slate-400">
            <Layers className="w-3 h-3 text-slate-500" />
            <span>Level: {row.floor?.level || 'N/A'}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Department',
      cell: (row) => (
        <div className="flex items-center space-x-1.5 text-slate-300 text-xs">
          <Building2 className="w-3.5 h-3.5 text-slate-500" />
          <span>{row.department?.name ?? 'Unassigned'}</span>
        </div>
      ),
    },
    {
      header: 'Capacity',
      cell: (row) => (
        <div className="flex items-center space-x-1.5 text-slate-300 text-xs">
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <span>{row.capacity} seats</span>
        </div>
      ),
    },
    {
      header: 'Occupancy Status',
      cell: (row) =>
        canSetOccupancy ? (
          <select
            value={row.occupancyStatus}
            disabled={occupancyMutation.isPending}
            onChange={(e) => void handleOccupancyChange(row, e.target.value as RoomOccupancyStatus)}
            className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-200"
          >
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="OCCUPIED">OCCUPIED</option>
            <option value="RESERVED">RESERVED</option>
            <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
          </select>
        ) : (
          getOccupancyBadge(row.occupancyStatus)
        ),
    },
    {
      header: 'Operational Status',
      cell: (row) => getOperationalBadge(row.operationalStatus),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center space-x-2">
          {canModify && (
            <button
              onClick={() => handleOpenEditModal(row)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Edit Room"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canArchive && row.operationalStatus !== 'RETIRED' && (
            <button
              onClick={() => setArchivingRoom(row)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
              title="Archive Room"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <Breadcrumb />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <DoorOpen className="w-8 h-8 text-emerald-400" />
            {pageTitle}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {pageSubtitle}
          </p>
        </div>

        {canModify && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Room</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5 text-emerald-400" />
          <span>Filters & Search</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Building Filter */}
          <select
            value={selectedBuildingId}
            onChange={(e) => {
              setSelectedBuildingId(e.target.value);
              setSelectedFloorId('');
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Buildings</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>

          {/* Floor Filter */}
          <select
            value={selectedFloorId}
            onChange={(e) => {
              setSelectedFloorId(e.target.value);
              setPage(1);
            }}
            disabled={isFloorsLoading}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Floors</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                Level: {f.level}
              </option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            value={selectedDepartmentId}
            onChange={(e) => {
              setSelectedDepartmentId(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>

          {/* Room Type Filter — hidden when locked via defaultRoomType prop */}
          {!defaultRoomType && (
            <select
              value={selectedRoomType}
              onChange={(e) => {
                setSelectedRoomType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Room Types</option>
              <option value="CLASSROOM">Classroom</option>
              <option value="LABORATORY">Laboratory</option>
              <option value="OFFICE">Office</option>
              <option value="SEMINAR_HALL">Seminar Hall</option>
              <option value="STORAGE">Storage</option>
              <option value="OTHER">Other</option>
            </select>
          )}

          {/* Occupancy Status Filter */}
          <select
            value={selectedOccupancy}
            onChange={(e) => {
              setSelectedOccupancy(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Occupancies</option>
            <option value="AVAILABLE">Available</option>
            <option value="OCCUPIED">Occupied</option>
            <option value="RESERVED">Reserved</option>
            <option value="UNDER_MAINTENANCE">Maintenance</option>
          </select>

          {/* Operational Status Filter */}
          <select
            value={selectedOperational}
            onChange={(e) => {
              setSelectedOperational(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Operations</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="UNDER_MAINTENANCE">Maintenance</option>
            <option value="DAMAGED">Damaged</option>
            <option value="RETIRED">Retired</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search room number..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-sm">
          Failed to load rooms directory. Please check your permissions or network connection.
        </div>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={rooms}
        isLoading={isLoading || isBuildingsLoading}
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
        emptyTitle="No Rooms Found"
        emptyDescription="No room records match your active filters."
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRoom ? 'Edit Room Configuration' : 'Create New Room'}
        subtitle={
          editingRoom
            ? `Modify specifications for Room ${editingRoom.roomNumber}`
            : 'Configure and allocate a new room storey space'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Target Building <span className="text-rose-400">*</span>
              </label>
              <select
                value={modalBuildingId}
                onChange={(e) => {
                  setModalBuildingId(e.target.value);
                  setModalFloorId('');
                }}
                disabled={Boolean(editingRoom)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="" disabled>Select Building</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Target Floor Level <span className="text-rose-400">*</span>
              </label>
              <select
                value={modalFloorId}
                onChange={(e) => setModalFloorId(e.target.value)}
                disabled={Boolean(editingRoom) || !modalBuildingId}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="" disabled>Select Floor</option>
                {modalFloors.map((f) => (
                  <option key={f.id} value={f.id}>
                    Level: {f.level}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Room Number / Code <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={roomNumberInput}
                onChange={(e) => setRoomNumberInput(e.target.value)}
                placeholder="e.g. 101, LAB-A"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Room Type <span className="text-rose-400">*</span>
              </label>
              <select
                value={roomTypeInput}
                onChange={(e) => setRoomTypeInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="CLASSROOM">Classroom</option>
                <option value="LABORATORY">Laboratory</option>
                <option value="OFFICE">Office</option>
                <option value="SEMINAR_HALL">Seminar Hall</option>
                <option value="STORAGE">Storage</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Capacity (Seats) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="1000"
                value={capacityInput}
                onChange={(e) => setCapacityInput(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Department <span className="text-slate-500">(optional)</span>
              </label>
              <select
                value={departmentIdInput}
                onChange={(e) => setDepartmentIdInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">No Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Operational Status <span className="text-rose-400">*</span>
              </label>
              <select
                value={operationalStatusInput}
                onChange={(e) => setOperationalStatusInput(e.target.value as OperationalStatus)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                <option value="DAMAGED">Damaged</option>
                <option value="RETIRED">Retired</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Occupancy Status <span className="text-rose-400">*</span>
              </label>
              <select
                value={occupancyStatusInput}
                onChange={(e) => setOccupancyStatusInput(e.target.value as RoomOccupancyStatus)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="AVAILABLE">Available</option>
                <option value="OCCUPIED">Occupied</option>
                <option value="RESERVED">Reserved</option>
                <option value="UNDER_MAINTENANCE">Under Maintenance</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingRoom
                ? 'Update Room'
                : 'Create Room'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Archive Modal */}
      <Modal
        isOpen={Boolean(archivingRoom)}
        onClose={() => setArchivingRoom(null)}
        title="Confirm Room Archival"
        subtitle="Archiving sets operational status to RETIRED."
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to archive <strong className="text-white">Room {archivingRoom?.roomNumber}</strong>?
            The room will be marked as RETIRED and hidden from active scheduling.
          </p>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setArchivingRoom(null)}
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
              {archiveMutation.isPending ? 'Archiving...' : 'Confirm Archive'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}