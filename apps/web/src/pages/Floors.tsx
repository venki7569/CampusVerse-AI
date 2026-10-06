import React, { useState } from 'react';
import { Layers, Plus, Edit2, Trash2, Building as BuildingIcon, Search } from 'lucide-react';
import { useFloors, useCreateFloor, useUpdateFloor, useDeleteFloor } from '../hooks/useFloors';
import { useBuildings } from '../hooks/useBuildings';
import { useAuth } from '../store/authContext';
import { useToast } from '../components/ui/Toast';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import type { Floor, CreateFloorInput, UpdateFloorInput } from '../types';

export function Floors() {
  const { hasAnyRole } = useAuth();
  const toast = useToast();
  const canModify = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN']);
  const canDelete = hasAnyRole(['SUPER_ADMIN']);

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const limit = 10;

  const { data: buildingsData, isLoading: isBuildingsLoading } = useBuildings({ limit: 100 });
  const buildings = buildingsData?.data || [];

  const { data: floorsData, isLoading, isError } = useFloors({
    page,
    limit,
    search: search || undefined,
    buildingId: selectedBuildingId || undefined,
  });

  const floors = floorsData?.data || [];
  const pagination = floorsData?.meta.pagination;

  const createMutation = useCreateFloor();
  const updateMutation = useUpdateFloor();
  const deleteMutation = useDeleteFloor();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const [deletingFloor, setDeletingFloor] = useState<Floor | null>(null);

  const [levelInput, setLevelInput] = useState('');
  const [buildingIdInput, setBuildingIdInput] = useState('');

  const handleOpenCreateModal = () => {
    setEditingFloor(null);
    setLevelInput('');
    setBuildingIdInput(selectedBuildingId || (buildings[0]?.id || ''));
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (floor: Floor) => {
    setEditingFloor(floor);
    setLevelInput(floor.level);
    setBuildingIdInput(floor.buildingId);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!levelInput.trim()) {
      toast.error('Validation Error', 'Floor level name/number is required');
      return;
    }

    try {
      if (editingFloor) {
        const updatePayload: UpdateFloorInput = { level: levelInput.trim() };
        await updateMutation.mutateAsync({ id: editingFloor.id, data: updatePayload });
        toast.success('Floor Updated', 'Floor level updated.');
      } else {
        if (!buildingIdInput) {
          toast.error('Validation Error', 'Target building must be selected');
          return;
        }
        const createPayload: CreateFloorInput = {
          level: levelInput.trim(),
          buildingId: buildingIdInput,
        };
        await createMutation.mutateAsync(createPayload);
        toast.success('Floor Created', 'Floor added.');
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred during submission';
      toast.error('Operation Failed', errorMsg);
    }
  };

  const handleDelete = async () => {
    if (!deletingFloor) return;
    try {
      await deleteMutation.mutateAsync(deletingFloor.id);
      toast.success('Floor Deleted', 'Floor has been removed.');
      setDeletingFloor(null);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete floor';
      toast.error('Deletion Failed', errorMsg);
    }
  };

  const columns: Column<Floor>[] = [
    {
      header: 'Floor Level / Name',
      cell: (row) => (
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-emerald-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-white text-sm">{row.level}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Building',
      cell: (row) => (
        <div className="flex items-center space-x-2 text-slate-300">
          <BuildingIcon className="w-3.5 h-3.5 text-slate-500" />
          <span>{row.building?.name || row.building?.code || 'N/A'}</span>
        </div>
      ),
    },
    {
      header: 'Rooms Allocated',
      cell: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
          {row._count?.rooms ?? 0} Rooms
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center space-x-2">
          {canModify && (
            <button
              onClick={() => handleOpenEditModal(row)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Edit Floor"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setDeletingFloor(row)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
              title="Delete Floor"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <Breadcrumb />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Layers className="w-8 h-8 text-emerald-400" />
            Floors Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Organize building storeys, levels, and view room allocation density across campus.
          </p>
        </div>

        {canModify && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Floor</span>
          </button>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <select
              value={selectedBuildingId}
              onChange={(e) => {
                setSelectedBuildingId(e.target.value);
                setPage(1);
              }}
              className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Buildings</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search level..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {isError && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-sm">
          Failed to load floors directory. Please check your permissions or network connection.
        </div>
      )}

      <DataTable
        columns={columns}
        data={floors}
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
        emptyTitle="No Floors Found"
        emptyDescription="No floor storeys match your selected building or search filter."
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingFloor ? 'Edit Floor Details' : 'Create New Floor'}
        subtitle={
          editingFloor
            ? 'Modify level configuration'
            : 'Assign a new storey level to a campus building'
        }
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Building <span className="text-rose-400">*</span>
            </label>
            <select
              value={buildingIdInput}
              onChange={(e) => setBuildingIdInput(e.target.value)}
              disabled={Boolean(editingFloor)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            >
              <option value="" disabled>
                Select Target Building
              </option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Floor Level / Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={levelInput}
              onChange={(e) => setLevelInput(e.target.value)}
              placeholder="Ground, 1, 2, Basement 1"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
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
                : editingFloor
                ? 'Update Floor'
                : 'Create Floor'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(deletingFloor)}
        onClose={() => setDeletingFloor(null)}
        title="Confirm Floor Deletion"
        subtitle="This action is restricted and requires SUPER_ADMIN privileges."
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to delete <strong className="text-white">Floor {deletingFloor?.level}</strong>?
            This will permanently remove the storey record.
          </p>

          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-300 text-xs">
            <strong>Note:</strong> Deletion will fail if the floor contains allocated rooms. Remove all rooms before deleting.
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setDeletingFloor(null)}
              className="px-4 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}