import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Search,
  DoorOpen,
  Phone,
  User,
  Eye,
  Calendar,
  Boxes,
} from 'lucide-react';
import {
  useDepartments,
  useDepartment,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from '../hooks/useDepartments';
import { useAuth } from '../store/authContext';
import { useToast } from '../components/ui/Toast';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import type {
  Department,
  CreateDepartmentInput,
  UpdateDepartmentInput,
  DepartmentQueryParams,
} from '../types';

export function Departments() {
  const { hasAnyRole } = useAuth();
  const toast = useToast();

  const canCreate = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN']);
  const canEdit = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN']);
  const canDelete = hasAnyRole(['SUPER_ADMIN']);

  // ─── Filter & Pagination state ────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const queryParams: DepartmentQueryParams = {
    page,
    limit,
    search: search || undefined,
    sortBy: 'name',
    sortOrder: 'asc',
  };

  const { data: departmentsData, isLoading, isError } = useDepartments(queryParams);
  const departments = departmentsData?.data ?? [];
  const pagination = departmentsData?.meta.pagination;

  // ─── Mutations ────────────────────────────────────────────────────────────
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();

  // ─── Modal state ──────────────────────────────────────────────────────────
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [viewingDeptId, setViewingDeptId] = useState<string | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);

  const { data: viewingDeptData, isLoading: isViewLoading } = useDepartment(viewingDeptId ?? '');
  const viewingDept = viewingDeptData?.data;

  // ─── Form inputs ──────────────────────────────────────────────────────────
  const [codeInput, setCodeInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [headNameInput, setHeadNameInput] = useState('');
  const [contactInfoInput, setContactInfoInput] = useState('');

  const openCreateModal = () => {
    setEditingDept(null);
    setCodeInput('');
    setNameInput('');
    setHeadNameInput('');
    setContactInfoInput('');
    setIsFormOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setCodeInput(dept.code);
    setNameInput(dept.name);
    setHeadNameInput(dept.headName ?? '');
    setContactInfoInput(dept.contactInfo ?? '');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      toast.error('Validation Error', 'Department name is required.');
      return;
    }

    try {
      if (editingDept) {
        const payload: UpdateDepartmentInput = {
          name: nameInput.trim(),
          headName: headNameInput.trim() || null,
          contactInfo: contactInfoInput.trim() || null,
        };
        await updateMutation.mutateAsync({ id: editingDept.id, data: payload });
        toast.success('Department Updated', `${nameInput} has been updated.`);
      } else {
        if (!codeInput.trim()) {
          toast.error('Validation Error', 'Department code is required.');
          return;
        }
        const payload: CreateDepartmentInput = {
          code: codeInput.trim().toUpperCase(),
          name: nameInput.trim(),
          headName: headNameInput.trim() || null,
          contactInfo: contactInfoInput.trim() || null,
        };
        await createMutation.mutateAsync(payload);
        toast.success('Department Created', `${nameInput} (${payload.code}) has been created.`);
      }
      setIsFormOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save department.';
      toast.error('Operation Failed', msg);
    }
  };

  const handleDelete = async () => {
    if (!deletingDept) return;
    try {
      await deleteMutation.mutateAsync(deletingDept.id);
      toast.success('Department Deleted', `${deletingDept.name} has been permanently deleted.`);
      setDeletingDept(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete department.';
      toast.error('Delete Failed', msg);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  // ─── Table columns ────────────────────────────────────────────────────────
  const columns: Column<Department>[] = [
    {
      header: 'Department',
      cell: (row) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm">{row.name}</div>
            <div className="text-[11px] font-mono text-violet-400 bg-violet-500/10 rounded px-1.5 py-0.5 inline-block mt-0.5">
              {row.code}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Head of Department',
      cell: (row) =>
        row.headName ? (
          <div className="flex items-center space-x-1.5 text-slate-300 text-xs">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span>{row.headName}</span>
          </div>
        ) : (
          <span className="text-slate-600 text-xs italic">Not assigned</span>
        ),
    },
    {
      header: 'Contact',
      cell: (row) =>
        row.contactInfo ? (
          <div className="flex items-center space-x-1.5 text-slate-300 text-xs">
            <Phone className="w-3.5 h-3.5 text-slate-500" />
            <span>{row.contactInfo}</span>
          </div>
        ) : (
          <span className="text-slate-600 text-xs italic">—</span>
        ),
    },
    {
      header: 'Rooms',
      cell: (row) => (
        <div className="flex items-center space-x-1.5 text-slate-300 text-xs">
          <DoorOpen className="w-3.5 h-3.5 text-slate-500" />
          <span>{row._count?.rooms ?? 0}</span>
        </div>
      ),
    },
    {
      header: 'Assets',
      cell: (row) => (
        <div className="flex items-center space-x-1.5 text-slate-300 text-xs">
          <Boxes className="w-3.5 h-3.5 text-slate-500" />
          <span>{row._count?.assets ?? 0}</span>
        </div>
      ),
    },
    {
      header: 'Created',
      cell: (row) => (
        <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>{formatDate(row.createdAt)}</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewingDeptId(row.id)}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="View Department"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {canEdit && (
            <button
              onClick={() => openEditModal(row)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Edit Department"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setDeletingDept(row)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
              title="Delete Department"
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

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Building2 className="w-8 h-8 text-violet-400" />
            Departments
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage academic and administrative departments, heads, and room allocations.
          </p>
        </div>

        {canCreate && (
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Department</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by code, name, or head..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-sm">
          Failed to load departments. Please check your permissions or network connection.
        </div>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={departments}
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
        emptyTitle="No Departments Found"
        emptyDescription="No departments match your search. Use the button above to create the first one."
      />

      {/* View Detail Modal */}
      <Modal
        isOpen={Boolean(viewingDeptId)}
        onClose={() => setViewingDeptId(null)}
        title="Department Details"
        subtitle={viewingDept ? `${viewingDept.code} — ${viewingDept.name}` : 'Loading...'}
        maxWidth="lg"
      >
        {isViewLoading ? (
          <div className="py-8 text-center text-slate-400 text-sm">Loading department details...</div>
        ) : viewingDept ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Code</p>
                <p className="text-sm font-mono text-violet-400">{viewingDept.code}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Name</p>
                <p className="text-sm text-white font-medium">{viewingDept.name}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Head of Department</p>
                <p className="text-sm text-slate-300">{viewingDept.headName || 'Not assigned'}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Contact</p>
                <p className="text-sm text-slate-300">{viewingDept.contactInfo || '—'}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Rooms</p>
                <p className="text-sm text-slate-300">{viewingDept._count?.rooms ?? 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Assets</p>
                <p className="text-sm text-slate-300">{viewingDept._count?.assets ?? 0}</p>
              </div>
            </div>

            {viewingDept.rooms && viewingDept.rooms.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Assigned Rooms
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {viewingDept.rooms.map((room) => (
                    <div
                      key={room.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                    >
                      <span className="font-medium text-white">{room.roomNumber}</span>
                      <span className="text-slate-500">{room.roomType} · {room.capacity} seats</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setViewingDeptId(null)}
                className="px-4 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-rose-400 text-sm">Department not found.</div>
        )}
      </Modal>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingDept ? 'Edit Department' : 'Create New Department'}
        subtitle={
          editingDept
            ? `Updating details for ${editingDept.name}`
            : 'Configure a new academic or administrative department'
        }
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Code — only on create */}
          {!editingDept && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Department Code <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. CS, MECH, ADMIN"
                maxLength={20}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 uppercase"
                required
              />
              <p className="text-[10px] text-slate-500 mt-1">Unique short code. Auto-uppercased. Cannot be changed after creation.</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Department Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Computer Science, Mechanical Engineering"
              maxLength={100}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              required
            />
          </div>

          {/* Head Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Head of Department <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="text"
              value={headNameInput}
              onChange={(e) => setHeadNameInput(e.target.value)}
              placeholder="e.g. Dr. Jane Doe"
              maxLength={100}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Contact Info */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Contact Information <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="text"
              value={contactInfoInput}
              onChange={(e) => setContactInfoInput(e.target.value)}
              placeholder="e.g. ext. 2401, dept-cs@university.edu"
              maxLength={200}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
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
                ? 'Saving...'
                : editingDept
                ? 'Update Department'
                : 'Create Department'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingDept)}
        onClose={() => setDeletingDept(null)}
        title="Delete Department"
        subtitle="This action is permanent and cannot be undone."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs leading-relaxed">
            <strong className="block mb-1">Before deleting:</strong>
            All rooms and assets must be reassigned or removed from this department.
            Deletion is blocked while any associations remain.
          </div>
          {(deletingDept?._count?.rooms ?? 0) > 0 && (
            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs">
              This department has {deletingDept?._count?.rooms} assigned room(s) and cannot be deleted until they are reassigned.
            </div>
          )}
          {(deletingDept?._count?.assets ?? 0) > 0 && (
            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs">
              This department has {deletingDept?._count?.assets} assigned asset(s) and cannot be deleted until they are reassigned.
            </div>
          )}
          <p className="text-sm text-slate-300">
            Are you sure you want to permanently delete{' '}
            <strong className="text-white">{deletingDept?.name}</strong>?
          </p>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setDeletingDept(null)}
              className="px-4 py-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={
                deleteMutation.isPending ||
                (deletingDept?._count?.rooms ?? 0) > 0 ||
                (deletingDept?._count?.assets ?? 0) > 0
              }
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
