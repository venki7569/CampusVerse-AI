import React, { useState } from 'react';
import {
  Boxes,
  Plus,
  Edit2,
  Archive,
  Search,
  Filter,
  Eye,
  Building as BuildingIcon,
  DoorOpen,
  Calendar,
  Building2,
  Tag,
  Wrench,
} from 'lucide-react';
import {
  useAssets,
  useAsset,
  useCreateAsset,
  useUpdateAsset,
  useArchiveAsset,
  useAssetCategories,
  useVendors,
} from '../hooks/useAssets';
import { useBuildings } from '../hooks/useBuildings';
import { useFloors } from '../hooks/useFloors';
import { useRooms } from '../hooks/useRooms';
import { useDepartments } from '../hooks/useDepartments';
import { useAuth } from '../store/authContext';
import { useToast } from '../components/ui/Toast';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import type {
  Asset,
  CreateAssetInput,
  UpdateAssetInput,
  OperationalStatus,
  AssetCondition,
  AssetQueryParams,
} from '../types';

const OPERATIONAL_STATUSES: OperationalStatus[] = [
  'ACTIVE',
  'INACTIVE',
  'UNDER_MAINTENANCE',
  'DAMAGED',
  'RETIRED',
];

const ASSET_CONDITIONS: AssetCondition[] = [
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'POOR',
  'DAMAGED',
];

export function Assets() {
  const { hasAnyRole } = useAuth();
  const toast = useToast();

  const canCreate = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN']);
  const canEdit = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN']);
  const canArchive = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN']);

  // ── Filters & Pagination State ─────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedCondition, setSelectedCondition] = useState<AssetCondition | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<OperationalStatus | ''>('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // ── Auxiliary Data for Selectors & Filters ─────────────────────────────────
  const { data: categoriesData } = useAssetCategories();
  const categories = Array.isArray(categoriesData?.data) ? categoriesData.data : [];

  const { data: vendorsData } = useVendors();
  const vendors = Array.isArray(vendorsData?.data) ? vendorsData.data : [];

  const { data: buildingsData } = useBuildings({ limit: 100 });
  const buildings = buildingsData?.data || [];

  const { data: filterFloorsData } = useFloors({
    buildingId: selectedBuilding || undefined,
    limit: 100,
  });
  const filterFloors = filterFloorsData?.data || [];

  const { data: filterRoomsData } = useRooms({
    buildingId: selectedBuilding || undefined,
    floorId: selectedFloor || undefined,
    limit: 100,
  });
  const filterRooms = filterRoomsData?.data || [];

  const { data: departmentsData } = useDepartments({ limit: 100, sortBy: 'name', sortOrder: 'asc' });
  const departments = departmentsData?.data || [];

  // ── Query Assets ──────────────────────────────────────────────────────────
  const queryParams: AssetQueryParams = {
    page,
    limit,
    search: search || undefined,
    categoryId: selectedCategory || undefined,
    departmentId: selectedDepartment || undefined,
    buildingId: selectedBuilding || undefined,
    roomId: selectedRoom || undefined,
    condition: selectedCondition || undefined,
    operationalStatus: selectedStatus || undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  const { data: assetsData, isLoading, isError } = useAssets(queryParams);
  const assets = assetsData?.data || [];
  const pagination = assetsData?.meta?.pagination;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useCreateAsset();
  const updateMutation = useUpdateAsset();
  const archiveMutation = useArchiveAsset();

  // ── Modal State ───────────────────────────────────────────────────────────
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [viewingAssetId, setViewingAssetId] = useState<string | null>(null);
  const [archivingAsset, setArchivingAsset] = useState<Asset | null>(null);

  const { data: viewingAssetData, isLoading: isViewLoading } = useAsset(viewingAssetId ?? '');
  const viewingAsset = viewingAssetData?.data;

  // ── Form State ────────────────────────────────────────────────────────────
  const [assetTagInput, setAssetTagInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [categoryIdInput, setCategoryIdInput] = useState('');
  const [vendorIdInput, setVendorIdInput] = useState('');
  const [departmentIdInput, setDepartmentIdInput] = useState('');
  const [formBuildingId, setFormBuildingId] = useState('');
  const [formFloorId, setFormFloorId] = useState('');
  const [formRoomId, setFormRoomId] = useState('');
  const [serialNumberInput, setSerialNumberInput] = useState('');
  const [purchaseDateInput, setPurchaseDateInput] = useState('');
  const [purchaseCostInput, setPurchaseCostInput] = useState<number | ''>('');
  const [warrantyExpiryInput, setWarrantyExpiryInput] = useState('');
  const [conditionInput, setConditionInput] = useState<AssetCondition | ''>('GOOD');
  const [statusInput, setStatusInput] = useState<OperationalStatus>('ACTIVE');
  const [lastMaintenanceInput, setLastMaintenanceInput] = useState('');
  const [nextMaintenanceInput, setNextMaintenanceInput] = useState('');

  // Dependent selectors for Modal
  const { data: formFloorsData } = useFloors({
    buildingId: formBuildingId || undefined,
    limit: 100,
  });
  const formFloors = formFloorsData?.data || [];

  const { data: formRoomsData } = useRooms({
    buildingId: formBuildingId || undefined,
    floorId: formFloorId || undefined,
    limit: 100,
  });
  const formRooms = formRoomsData?.data || [];

  const openCreateModal = () => {
    setEditingAsset(null);
    setAssetTagInput('');
    setNameInput('');
    setCategoryIdInput(categories[0]?.id || '');
    setVendorIdInput('');
    setDepartmentIdInput('');
    setFormBuildingId('');
    setFormFloorId('');
    setFormRoomId('');
    setSerialNumberInput('');
    setPurchaseDateInput('');
    setPurchaseCostInput('');
    setWarrantyExpiryInput('');
    setConditionInput('GOOD');
    setStatusInput('ACTIVE');
    setLastMaintenanceInput('');
    setNextMaintenanceInput('');
    setIsFormOpen(true);
  };

  const openEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setAssetTagInput(asset.assetTag);
    setNameInput(asset.name);
    setCategoryIdInput(asset.categoryId);
    setVendorIdInput(asset.vendorId ?? '');
    setDepartmentIdInput(asset.departmentId ?? '');
    setFormBuildingId(asset.buildingId ?? asset.room?.floor?.building?.id ?? '');
    setFormFloorId(asset.room?.floor?.id ?? '');
    setFormRoomId(asset.roomId ?? '');
    setSerialNumberInput(asset.serialNumber ?? '');
    setPurchaseDateInput(asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '');
    setPurchaseCostInput(asset.purchaseCost ?? '');
    setWarrantyExpiryInput(asset.warrantyExpiry ? asset.warrantyExpiry.split('T')[0] : '');
    setConditionInput(asset.condition ?? 'GOOD');
    setStatusInput(asset.operationalStatus);
    setLastMaintenanceInput(asset.lastMaintenance ? asset.lastMaintenance.split('T')[0] : '');
    setNextMaintenanceInput(asset.nextMaintenance ? asset.nextMaintenance.split('T')[0] : '');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assetTagInput.trim()) {
      toast.error('Validation Error', 'Asset tag is required.');
      return;
    }
    if (!nameInput.trim()) {
      toast.error('Validation Error', 'Asset name is required.');
      return;
    }
    if (!categoryIdInput) {
      toast.error('Validation Error', 'Category is required.');
      return;
    }

    try {
      if (editingAsset) {
        const payload: UpdateAssetInput = {
          assetTag: assetTagInput.trim(),
          name: nameInput.trim(),
          categoryId: categoryIdInput,
          vendorId: vendorIdInput || null,
          departmentId: departmentIdInput || null,
          buildingId: formBuildingId || null,
          roomId: formRoomId || null,
          serialNumber: serialNumberInput.trim() || null,
          purchaseDate: purchaseDateInput || null,
          purchaseCost: purchaseCostInput !== '' ? Number(purchaseCostInput) : null,
          warrantyExpiry: warrantyExpiryInput || null,
          condition: conditionInput || null,
          operationalStatus: statusInput,
          lastMaintenance: lastMaintenanceInput || null,
          nextMaintenance: nextMaintenanceInput || null,
        };
        await updateMutation.mutateAsync({ id: editingAsset.id, data: payload });
        toast.success('Asset Updated', `Asset "${assetTagInput}" was updated successfully.`);
      } else {
        const payload: CreateAssetInput = {
          assetTag: assetTagInput.trim(),
          name: nameInput.trim(),
          categoryId: categoryIdInput,
          vendorId: vendorIdInput || undefined,
          departmentId: departmentIdInput || undefined,
          buildingId: formBuildingId || undefined,
          roomId: formRoomId || undefined,
          serialNumber: serialNumberInput.trim() || undefined,
          purchaseDate: purchaseDateInput || undefined,
          purchaseCost: purchaseCostInput !== '' ? Number(purchaseCostInput) : undefined,
          warrantyExpiry: warrantyExpiryInput || undefined,
          condition: conditionInput || undefined,
          operationalStatus: statusInput,
          lastMaintenance: lastMaintenanceInput || undefined,
          nextMaintenance: nextMaintenanceInput || undefined,
        };
        await createMutation.mutateAsync(payload);
        toast.success('Asset Created', `Asset "${assetTagInput}" has been registered.`);
      }
      setIsFormOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed.';
      toast.error('Operation Failed', msg);
    }
  };

  const handleArchive = async () => {
    if (!archivingAsset) return;
    try {
      await archiveMutation.mutateAsync(archivingAsset.id);
      toast.success('Asset Archived', `Asset "${archivingAsset.assetTag}" set to RETIRED status.`);
      setArchivingAsset(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to archive asset.';
      toast.error('Archive Failed', msg);
    }
  };

  // ── Badges ────────────────────────────────────────────────────────────────
  const getStatusBadge = (status: OperationalStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ACTIVE</span>;
      case 'INACTIVE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">INACTIVE</span>;
      case 'UNDER_MAINTENANCE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">MAINTENANCE</span>;
      case 'DAMAGED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">DAMAGED</span>;
      case 'RETIRED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">RETIRED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  const getConditionBadge = (condition: AssetCondition | null | undefined) => {
    switch (condition) {
      case 'EXCELLENT':
        return <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">EXCELLENT</span>;
      case 'GOOD':
        return <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">GOOD</span>;
      case 'FAIR':
        return <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">FAIR</span>;
      case 'POOR':
        return <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">POOR</span>;
      case 'DAMAGED':
        return <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">DAMAGED</span>;
      default:
        return <span className="text-[10px] text-slate-500">—</span>;
    }
  };

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns: Column<Asset>[] = [
    {
      header: 'Asset Tag / Name',
      cell: (row) => (
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-emerald-400">
            <Boxes className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm">{row.name}</div>
            <div className="text-[11px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
              {row.assetTag}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Category',
      cell: (row) => (
        <div className="flex items-center space-x-1.5 text-xs text-slate-300">
          <Tag className="w-3.5 h-3.5 text-slate-500" />
          <span>{row.category?.name ?? '—'}</span>
        </div>
      ),
    },
    {
      header: 'Serial No.',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-400">{row.serialNumber || '—'}</span>
      ),
    },
    {
      header: 'Location',
      cell: (row) => {
        const bld = row.building?.name || row.room?.floor?.building?.name;
        const roomNum = row.room?.roomNumber;
        const floorLvl = row.room?.floor?.level;

        if (roomNum) {
          return (
            <div className="text-xs space-y-0.5">
              <div className="text-slate-200 font-medium flex items-center space-x-1">
                <DoorOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Room {roomNum}</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                <BuildingIcon className="w-3 h-3 text-slate-500 shrink-0" />
                <span>{bld} (Lvl {floorLvl})</span>
              </div>
            </div>
          );
        }

        if (bld) {
          return (
            <div className="text-xs text-slate-300 flex items-center space-x-1">
              <BuildingIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{bld} (Building-level)</span>
            </div>
          );
        }

        return <span className="text-xs text-slate-500 italic">Unassigned</span>;
      },
    },
    {
      header: 'Department',
      cell: (row) => (
        <div className="flex items-center space-x-1.5 text-xs text-slate-300">
          <Building2 className="w-3.5 h-3.5 text-slate-500" />
          <span>{row.department?.name ?? '—'}</span>
        </div>
      ),
    },
    {
      header: 'Condition',
      cell: (row) => getConditionBadge(row.condition),
    },
    {
      header: 'Status',
      cell: (row) => getStatusBadge(row.operationalStatus),
    },
    {
      header: 'Warranty',
      cell: (row) => (
        <span className="text-xs text-slate-400">{formatDate(row.warrantyExpiry)}</span>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewingAssetId(row.id)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/30 transition-colors"
            title="View Asset Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {canEdit && (
            <button
              onClick={() => openEditModal(row)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Edit Asset"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canArchive && row.operationalStatus !== 'RETIRED' && (
            <button
              onClick={() => setArchivingAsset(row)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
              title="Archive Asset"
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

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Boxes className="w-8 h-8 text-emerald-400" />
            Assets Directory
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Track hardware, lab instruments, furniture, purchase details, location, and maintenance lifecycle.
          </p>
        </div>

        {canCreate && (
          <button
            id="add-asset-btn"
            onClick={openCreateModal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Asset</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5 text-emerald-400" />
          <span>Filters &amp; Search</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            value={selectedDepartment}
            onChange={(e) => {
              setSelectedDepartment(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Building Filter */}
          <select
            value={selectedBuilding}
            onChange={(e) => {
              setSelectedBuilding(e.target.value);
              setSelectedFloor('');
              setSelectedRoom('');
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Buildings</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Floor Filter */}
          <select
            value={selectedFloor}
            onChange={(e) => {
              setSelectedFloor(e.target.value);
              setSelectedRoom('');
              setPage(1);
            }}
            disabled={!selectedBuilding}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Floors</option>
            {filterFloors.map((f) => (
              <option key={f.id} value={f.id}>
                Level: {f.level}
              </option>
            ))}
          </select>

          {/* Room Filter */}
          <select
            value={selectedRoom}
            onChange={(e) => {
              setSelectedRoom(e.target.value);
              setPage(1);
            }}
            disabled={!selectedBuilding}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Rooms</option>
            {filterRooms.map((r) => (
              <option key={r.id} value={r.id}>
                Room {r.roomNumber}
              </option>
            ))}
          </select>

          {/* Condition Filter */}
          <select
            value={selectedCondition}
            onChange={(e) => {
              setSelectedCondition(e.target.value as AssetCondition | '');
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Conditions</option>
            {ASSET_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value as OperationalStatus | '');
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Statuses</option>
            {OPERATIONAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
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
              placeholder="Search assets..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-sm">
          Failed to load assets. Please check your connection or permissions.
        </div>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={assets}
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
        emptyTitle="No Assets Found"
        emptyDescription="No assets match your search and filter criteria."
      />

      {/* ── Create / Edit Modal ───────────────────────────────────────────── */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingAsset ? 'Edit Asset' : 'Register New Asset'}
        subtitle={
          editingAsset
            ? `Modify record for ${editingAsset.name} (${editingAsset.assetTag})`
            : 'Enter inventory, procurement, and location details'
        }
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tag, Name, Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Asset Tag / Code <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={assetTagInput}
                onChange={(e) => setAssetTagInput(e.target.value)}
                placeholder="e.g. AST-0010"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white uppercase placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Asset Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Dell Precision 3660"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Category <span className="text-rose-400">*</span>
              </label>
              <select
                value={categoryIdInput}
                onChange={(e) => setCategoryIdInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="" disabled>Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Department, Vendor, Serial */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Department <span className="text-slate-500">(optional)</span>
              </label>
              <select
                value={departmentIdInput}
                onChange={(e) => setDepartmentIdInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Unassigned</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Vendor <span className="text-slate-500">(optional)</span>
              </label>
              <select
                value={vendorIdInput}
                onChange={(e) => setVendorIdInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">No Vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Serial Number <span className="text-slate-500">(optional)</span>
              </label>
              <input
                type="text"
                value={serialNumberInput}
                onChange={(e) => setSerialNumberInput(e.target.value)}
                placeholder="e.g. SN-8941038"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Dependent Location Selectors: Building -> Floor -> Room */}
          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
            <div className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
              <BuildingIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>Location Assignment (Building &rarr; Floor &rarr; Room)</span>
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
                  }}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">None / Unassigned</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
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
                  }}
                  disabled={!formBuildingId}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Any / Building-wide</option>
                  {formFloors.map((f) => (
                    <option key={f.id} value={f.id}>
                      Level {f.level}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Target Room</label>
                <select
                  value={formRoomId}
                  onChange={(e) => setFormRoomId(e.target.value)}
                  disabled={!formBuildingId}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">None (Building-level)</option>
                  {formRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.roomNumber} ({r.roomType})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Condition, Operational Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Condition</label>
              <select
                value={conditionInput}
                onChange={(e) => setConditionInput(e.target.value as AssetCondition)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {ASSET_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Operational Status <span className="text-rose-400">*</span>
              </label>
              <select
                value={statusInput}
                onChange={(e) => setStatusInput(e.target.value as OperationalStatus)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {OPERATIONAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Purchase Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Purchase Cost ($) <span className="text-slate-500">(optional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={purchaseCostInput}
                onChange={(e) => setPurchaseCostInput(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Purchase Date</label>
              <input
                type="date"
                value={purchaseDateInput}
                onChange={(e) => setPurchaseDateInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Warranty Expiry</label>
              <input
                type="date"
                value={warrantyExpiryInput}
                onChange={(e) => setWarrantyExpiryInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Maintenance Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Last Maintenance Date</label>
              <input
                type="date"
                value={lastMaintenanceInput}
                onChange={(e) => setLastMaintenanceInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Next Scheduled Maintenance</label>
              <input
                type="date"
                value={nextMaintenanceInput}
                onChange={(e) => setNextMaintenanceInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Actions */}
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
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingAsset
                ? 'Update Asset'
                : 'Register Asset'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View Detail Modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(viewingAssetId)}
        onClose={() => setViewingAssetId(null)}
        title="Asset Lifecycle Profile"
        subtitle="Complete specification, procurement, location & maintenance history"
        maxWidth="2xl"
      >
        {isViewLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          </div>
        ) : viewingAsset ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex items-center space-x-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="p-3 rounded-xl bg-slate-800 text-emerald-400">
                <Boxes className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">{viewingAsset.name}</h3>
                  {getStatusBadge(viewingAsset.operationalStatus)}
                </div>
                <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                  <span className="font-mono font-bold text-emerald-400">{viewingAsset.assetTag}</span>
                  <span>&bull;</span>
                  <span>{viewingAsset.category?.name}</span>
                  {viewingAsset.serialNumber && (
                    <>
                      <span>&bull;</span>
                      <span className="font-mono">SN: {viewingAsset.serialNumber}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Grid Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <p className="text-slate-500 uppercase tracking-wider mb-1">Condition</p>
                <div className="mt-0.5">{getConditionBadge(viewingAsset.condition)}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <p className="text-slate-500 uppercase tracking-wider mb-1">Department</p>
                <span className="text-slate-200 font-medium">{viewingAsset.department?.name ?? 'Unassigned'}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <p className="text-slate-500 uppercase tracking-wider mb-1">Vendor</p>
                <span className="text-slate-200 font-medium">{viewingAsset.vendor?.name ?? '—'}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <p className="text-slate-500 uppercase tracking-wider mb-1">Purchase Cost</p>
                <span className="text-slate-200 font-medium font-mono">
                  {viewingAsset.purchaseCost != null ? `$${viewingAsset.purchaseCost.toLocaleString()}` : '—'}
                </span>
              </div>
            </div>

            {/* Location & Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                <p className="text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <BuildingIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Location Hierarchy</span>
                </p>
                <p className="text-slate-300">
                  <strong className="text-white">Building:</strong>{' '}
                  {viewingAsset.building?.name || viewingAsset.room?.floor?.building?.name || 'Unassigned'}
                </p>
                {viewingAsset.room?.floor && (
                  <p className="text-slate-300">
                    <strong className="text-white">Floor:</strong> Level {viewingAsset.room.floor.level}
                  </p>
                )}
                {viewingAsset.room && (
                  <p className="text-slate-300">
                    <strong className="text-white">Room:</strong> {viewingAsset.room.roomNumber} ({viewingAsset.room.roomType})
                  </p>
                )}
              </div>

              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                <p className="text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Key Lifecycle Dates</span>
                </p>
                <p className="text-slate-300">
                  <strong className="text-white">Purchased:</strong> {formatDate(viewingAsset.purchaseDate)}
                </p>
                <p className="text-slate-300">
                  <strong className="text-white">Warranty Expiry:</strong> {formatDate(viewingAsset.warrantyExpiry)}
                </p>
                <p className="text-slate-300">
                  <strong className="text-white">Last Maintenance:</strong> {formatDate(viewingAsset.lastMaintenance)}
                </p>
                <p className="text-slate-300">
                  <strong className="text-white">Next Scheduled:</strong> {formatDate(viewingAsset.nextMaintenance)}
                </p>
              </div>
            </div>

            {/* Maintenance History */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                <span>Maintenance History Records</span>
              </div>

              {viewingAsset.maintenanceHistory && viewingAsset.maintenanceHistory.length > 0 ? (
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  {viewingAsset.maintenanceHistory.map((item) => (
                    <div key={item.id} className="p-3 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">{item.action}</div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          {item.notes || 'No extra notes'} &bull; Tech: {item.technicianId || 'Staff'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-400">{formatDate(item.performedAt)}</div>
                        {item.cost != null && (
                          <div className="text-emerald-400 font-mono font-medium mt-0.5">${item.cost}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
                  No maintenance service logs recorded for this asset yet.
                </div>
              )}
            </div>

            {/* Actions */}
            {canEdit && (
              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button
                  onClick={() => {
                    setViewingAssetId(null);
                    openEditModal(viewingAsset);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Asset Profile</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Asset record not found.</p>
        )}
      </Modal>

      {/* ── Archive Confirmation Modal ────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(archivingAsset)}
        onClose={() => setArchivingAsset(null)}
        title="Confirm Asset Retirement"
        subtitle="This action archives the asset by setting operational status to RETIRED."
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to retire <strong className="text-white">{archivingAsset?.name}</strong>{' '}
            (<span className="font-mono text-emerald-400">{archivingAsset?.assetTag}</span>)?
            The asset will be marked as RETIRED and hidden from active assignments, but its historical records will be preserved.
          </p>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setArchivingAsset(null)}
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
              {archiveMutation.isPending ? 'Archiving...' : 'Confirm Retire'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
