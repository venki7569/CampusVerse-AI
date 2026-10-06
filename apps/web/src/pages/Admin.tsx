import { useMemo, useState } from 'react';
import {
  ShieldAlert,
  Users,
  KeyRound,
  ScrollText,
  Plus,
  Eye,
  Edit2,
  Power,
  PowerOff,
  Search,
  Save,
  Activity,
} from 'lucide-react';
import {
  useAdminUsers,
  useAdminUser,
  useCreateAdminUser,
  useUpdateAdminUser,
  useUpdateUserStatus,
  useResetAdminUserPassword,
  useRoles,
  useRole,
  useCreateRole,
  useUpdateRole,
  useUpdateRolePermissions,
  usePermissions,
  useAdminAudit,
  useSystemHealth,
} from '../hooks/useAdmin';
import { useDepartments } from '../hooks/useDepartments';
import { useAuth, type RoleName } from '../store/authContext';
import { useToast } from '../components/ui/Toast';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { ErrorState } from '../components/ui/ErrorState';
import { KpiCard } from '../components/ui/KpiCard';
import type {
  AdminUser,
  CreateUserInput,
  Permission,
  Role,
  UpdateUserInput,
  UserStatus,
} from '../types';

type AdminTab = 'users' | 'roles' | 'permissions' | 'audit' | 'health';

const ROLE_OPTIONS: RoleName[] = [
  'SUPER_ADMIN',
  'CAMPUS_ADMIN',
  'DEPARTMENT_ADMIN',
  'FACULTY',
  'STUDENT',
  'MAINTENANCE_STAFF',
  'SECURITY_STAFF',
];

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function Admin() {
  const { hasAnyRole, hasRole } = useAuth();
  const toast = useToast();
  const canManageUsers = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN']);
  const canManageRoles = hasRole('SUPER_ADMIN');
  const canManagePermissions = hasRole('SUPER_ADMIN');
  const canReadAudit = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN']);
  const canViewSystemHealth = hasAnyRole(['SUPER_ADMIN', 'CAMPUS_ADMIN']);

  const [tab, setTab] = useState<AdminTab>('users');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleId, setRoleId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<string[]>([]);
  const [roleDescription, setRoleDescription] = useState('');
  const [createRoleName, setCreateRoleName] = useState<RoleName>('SECURITY_STAFF');
  const [createRoleDescription, setCreateRoleDescription] = useState('');
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [formRoleName, setFormRoleName] = useState<RoleName>('FACULTY');
  const [formDepartmentId, setFormDepartmentId] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  const userParams = useMemo(
    () => ({
      page,
      limit: 10,
      search: search || undefined,
      roleId: roleId || undefined,
      departmentId: departmentId || undefined,
      status: status || undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc' as const,
    }),
    [page, search, roleId, departmentId, status],
  );

  const { data: usersData, isLoading: usersLoading, isError: usersError, refetch } =
    useAdminUsers(userParams);
  const { data: rolesData } = useRoles({ page: 1, limit: 50, sortBy: 'name', sortOrder: 'asc' });
  const { data: permissionsData } = usePermissions({ page: 1, limit: 100, sortBy: 'resource' });
  const { data: departmentsData } = useDepartments({ page: 1, limit: 100, sortBy: 'name' });
  const { data: viewingUserData } = useAdminUser(viewingUserId ?? '');
  const { data: selectedRoleData } = useRole(selectedRoleId ?? '');
  const { data: auditData } = useAdminAudit({ page: 1, limit: 20 });
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useSystemHealth({
    enabled: canViewSystemHealth && tab === 'health',
  });

  const createUser = useCreateAdminUser();
  const updateUser = useUpdateAdminUser();
  const updateStatus = useUpdateUserStatus();
  const resetPasswordMutation = useResetAdminUserPassword();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const updateRolePermissions = useUpdateRolePermissions();

  const users = usersData?.data ?? [];
  const pagination = usersData?.meta.pagination;
  const roles = rolesData?.data ?? [];
  const permissions = permissionsData?.data ?? [];
  const departments = departmentsData?.data ?? [];
  const viewingUser = viewingUserData?.data;
  const selectedRole = selectedRoleData?.data;
  const auditEvents = auditData?.data ?? [];

  const openCreateUser = () => {
    setEditingUser(null);
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setFormRoleName('FACULTY');
    setFormDepartmentId('');
    setResetPassword('');
    setIsUserFormOpen(true);
  };

  const openEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setEmail(user.email);
    setPassword('');
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setFormRoleName((user.roles[0]?.name as RoleName) || 'FACULTY');
    setFormDepartmentId(user.departmentId ?? '');
    setResetPassword('');
    setIsUserFormOpen(true);
  };

  const openRoleEditor = (role: Role) => {
    setSelectedRoleId(role.id);
    setRoleDescription(role.description ?? '');
    setPermissionDraft((role.permissions ?? []).map((p) => p.id));
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const payload: UpdateUserInput = {
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          roleName: formRoleName,
          departmentId: formDepartmentId || null,
        };
        await updateUser.mutateAsync({ id: editingUser.id, data: payload });
        if (resetPassword.trim().length >= 8) {
          await resetPasswordMutation.mutateAsync({
            id: editingUser.id,
            password: resetPassword.trim(),
          });
        }
        toast.success('User updated', `${firstName} ${lastName} saved`);
      } else {
        if (password.trim().length < 8) {
          toast.error('Validation Error', 'Password must be at least 8 characters');
          return;
        }
        const payload: CreateUserInput = {
          email: email.trim().toLowerCase(),
          password: password.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          roleName: formRoleName,
          departmentId: formDepartmentId || null,
          isActive: true,
        };
        await createUser.mutateAsync(payload);
        toast.success('User created', `${firstName} ${lastName} is ready`);
      }
      setIsUserFormOpen(false);
    } catch (err: unknown) {
      toast.error('Save failed', err instanceof Error ? err.message : 'Could not save user');
    }
  };

  const handleToggleStatus = async (user: AdminUser) => {
    try {
      await updateStatus.mutateAsync({
        id: user.id,
        data: { status: user.isActive ? 'INACTIVE' : 'ACTIVE' },
      });
      toast.success(
        user.isActive ? 'User deactivated' : 'User activated',
        `${user.firstName} ${user.lastName}`,
      );
    } catch (err: unknown) {
      toast.error('Status update failed', err instanceof Error ? err.message : 'Request failed');
    }
  };

  const handleSaveRole = async () => {
    if (!selectedRoleId) return;
    try {
      await updateRole.mutateAsync({
        id: selectedRoleId,
        data: { description: roleDescription || null },
      });
      if (canManagePermissions) {
        await updateRolePermissions.mutateAsync({
          roleId: selectedRoleId,
          data: { permissionIds: permissionDraft },
        });
      }
      toast.success('Role saved', 'Role details and permissions updated');
    } catch (err: unknown) {
      toast.error('Role save failed', err instanceof Error ? err.message : 'Request failed');
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRole.mutateAsync({
        name: createRoleName,
        description: createRoleDescription || null,
      });
      toast.success('Role created', createRoleName);
      setIsCreateRoleOpen(false);
    } catch (err: unknown) {
      toast.error('Create failed', err instanceof Error ? err.message : 'Could not create role');
    }
  };

  const userColumns: Column<AdminUser>[] = [
    {
      header: 'Name',
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">
            {row.firstName} {row.lastName}
          </p>
          <p className="text-xs text-slate-400">{row.email}</p>
        </div>
      ),
    },
    {
      header: 'Role',
      cell: (row) => (
        <span className="text-xs font-semibold text-emerald-400">
          {row.roles.map((r) => r.name.replace(/_/g, ' ')).join(', ') || '—'}
        </span>
      ),
    },
    {
      header: 'Department',
      cell: (row) => row.department?.name ?? '—',
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
          {row.status}
        </span>
      ),
    },
    {
      header: 'Created',
      cell: (row) => <span className="text-xs text-slate-400">{formatDate(row.createdAt)}</span>,
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewingUserId(row.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          {canManageUsers && (
            <>
              <button
                onClick={() => openEditUser(row)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => void handleToggleStatus(row)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                title={row.isActive ? 'Deactivate' : 'Activate'}
              >
                {row.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const roleColumns: Column<Role>[] = [
    {
      header: 'Role',
      cell: (row) => (
        <div>
          <p className="font-semibold text-white">{row.name.replace(/_/g, ' ')}</p>
          <p className="text-xs text-slate-400">{row.description ?? 'No description'}</p>
        </div>
      ),
    },
    {
      header: 'System',
      cell: (row) => (row.isSystem ? 'Yes' : 'No'),
    },
    { header: 'Users', cell: (row) => row.userCount },
    { header: 'Permissions', cell: (row) => row.permissionCount },
    {
      header: 'Actions',
      cell: (row) => (
        <button
          onClick={() => openRoleEditor(row)}
          className="px-2 py-1 rounded text-xs bg-slate-800 text-emerald-400 hover:bg-slate-700"
        >
          Manage
        </button>
      ),
    },
  ];

  const permissionColumns: Column<Permission>[] = [
    {
      header: 'Code',
      cell: (row) => <span className="font-mono text-xs text-emerald-400">{row.code}</span>,
    },
    { header: 'Description', cell: (row) => row.description ?? '—' },
    {
      header: 'Assigned Roles',
      cell: (row) =>
        row.assignedRoles.map((r) => r.name.replace(/_/g, ' ')).join(', ') || 'Unassigned',
    },
  ];

  const tabs: Array<{ id: AdminTab; label: string; visible: boolean }> = [
    { id: 'users', label: 'Users', visible: true },
    { id: 'roles', label: 'Roles', visible: true },
    { id: 'permissions', label: 'Permissions', visible: true },
    { id: 'audit', label: 'Audit', visible: canReadAudit },
    { id: 'health', label: 'System Health', visible: canViewSystemHealth },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Breadcrumb />
          <h1 className="text-2xl font-bold text-white mt-2 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-emerald-400" />
            Admin Control
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            User management, roles, permissions, and RBAC audit activity.
          </p>
        </div>
        {tab === 'users' && canManageUsers && (
          <button
            onClick={openCreateUser}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-sm hover:bg-emerald-400"
          >
            <Plus className="w-4 h-4" />
            Create User
          </button>
        )}
        {tab === 'roles' && canManageRoles && (
          <button
            onClick={() => setIsCreateRoleOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-sm hover:bg-emerald-400"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Users" value={pagination?.total ?? users.length} icon={Users} />
        <KpiCard title="Roles" value={roles.length} icon={ShieldAlert} />
        <KpiCard title="Permissions" value={permissions.length} icon={KeyRound} />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {tabs
          .filter((item) => item.visible)
          .map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === item.id
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
      </div>

      {tab === 'users' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search users..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              />
            </div>
            <select
              value={roleId}
              onChange={(e) => {
                setRoleId(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-white px-3 py-2"
            >
              <option value="">All roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-white px-3 py-2"
            >
              <option value="">All departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as UserStatus | '');
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-white px-3 py-2"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {usersError ? (
            <ErrorState title="Users unavailable" onRetry={() => void refetch()} />
          ) : (
            <DataTable
              columns={userColumns}
              data={users}
              isLoading={usersLoading}
              emptyTitle="No users found"
              emptyDescription="Try adjusting filters or create a new user."
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
        </div>
      )}

      {tab === 'roles' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <DataTable
            columns={roleColumns}
            data={roles}
            emptyTitle="No roles"
            emptyDescription="System roles will appear after seeding."
          />
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-bold text-white">Role detail</h3>
            {!selectedRole ? (
              <p className="text-xs text-slate-500">Select a role to edit description and permissions.</p>
            ) : (
              <>
                <div>
                  <p className="text-emerald-400 font-semibold">{selectedRole.name.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedRole.isSystem ? 'System role' : 'Configurable role'} ·{' '}
                    {selectedRole.userCount} users
                  </p>
                </div>
                <label className="block text-xs text-slate-400">
                  Description
                  <textarea
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    disabled={!canManageRoles}
                    className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg text-sm text-white p-2 min-h-20"
                  />
                </label>
                <div>
                  <p className="text-xs text-slate-400 mb-2">Permissions</p>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {Object.entries(
                      permissions.reduce<Record<string, Permission[]>>((acc, permission) => {
                        const group = acc[permission.resource] ?? [];
                        group.push(permission);
                        acc[permission.resource] = group;
                        return acc;
                      }, {}),
                    ).map(([resource, items]) => (
                      <div key={resource} className="border border-slate-800 rounded-lg p-2">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                          {resource}
                        </p>
                        {items.map((permission) => (
                          <label
                            key={permission.id}
                            className="flex items-center gap-2 text-xs text-slate-300 py-1"
                          >
                            <input
                              type="checkbox"
                              checked={permissionDraft.includes(permission.id)}
                              disabled={!canManagePermissions}
                              onChange={(e) => {
                                setPermissionDraft((prev) =>
                                  e.target.checked
                                    ? [...prev, permission.id]
                                    : prev.filter((id) => id !== permission.id),
                                );
                              }}
                            />
                            <span className="font-mono text-emerald-400">{permission.code}</span>
                            <span className="text-slate-500">{permission.description}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                {canManageRoles && (
                  <button
                    onClick={() => void handleSaveRole()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save role
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'permissions' && (
        <DataTable
          columns={permissionColumns}
          data={permissions}
          emptyTitle="No permissions"
          emptyDescription="Seed the database to load the permission catalog."
        />
      )}

      {tab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">RBAC audit activity</h3>
          </div>
          <div className="divide-y divide-slate-800">
            {auditEvents.length === 0 ? (
              <p className="p-6 text-xs text-slate-500">No audit events yet.</p>
            ) : (
              auditEvents.map((event) => (
                <div key={event.id} className="p-4 text-xs">
                  <div className="flex justify-between gap-3">
                    <p className="font-semibold text-white">{event.action}</p>
                    <span className="text-slate-500">{formatDate(event.createdAt)}</span>
                  </div>
                  <p className="text-slate-400 mt-1">
                    {event.entityName} · {event.entityId} · actor {event.actorId}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'health' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">System health</h3>
            </div>
            <button
              onClick={() => void refetchHealth()}
              className="text-xs text-slate-400 hover:text-white"
            >
              Refresh
            </button>
          </div>
          {healthLoading ? (
            <p className="p-6 text-xs text-slate-500">Loading health report…</p>
          ) : (
            <div className="p-4 space-y-3">
              <p className="text-sm text-white">
                Status:{' '}
                <span className="font-semibold text-emerald-400">
                  {healthData?.data.status ?? 'unknown'}
                </span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {Object.entries(healthData?.data.dependencies ?? {}).map(([name, dep]) => (
                  <div key={name} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
                    <p className="font-semibold text-white capitalize">{name}</p>
                    <p className="text-slate-400 mt-1">Status: {dep.status}</p>
                    {dep.latencyMs !== undefined && (
                      <p className="text-slate-500">Latency: {dep.latencyMs}ms</p>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                No credentials or connection strings are exposed. Gemini shows configuration status only.
              </p>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={isUserFormOpen}
        onClose={() => setIsUserFormOpen(false)}
        title={editingUser ? 'Edit user' : 'Create user'}
        subtitle="Passwords are never displayed after save."
      >
        <form onSubmit={(e) => void handleSaveUser(e)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              placeholder="First name"
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              placeholder="Last name"
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            placeholder="Email"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
          />
          {!editingUser && (
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              placeholder="Temporary password"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
            />
          )}
          {editingUser && canManageUsers && (
            <input
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              type="password"
              placeholder="Reset password (optional, min 8 chars)"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
            />
          )}
          <select
            value={formRoleName}
            onChange={(e) => setFormRoleName(e.target.value as RoleName)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
          >
            {ROLE_OPTIONS.map((name) => (
              <option key={name} value={name}>
                {name.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select
            value={formDepartmentId}
            onChange={(e) => setFormDepartmentId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">No department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-semibold"
          >
            Save user
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(viewingUserId)}
        onClose={() => setViewingUserId(null)}
        title="User details"
        subtitle={viewingUser?.email}
      >
        {!viewingUser ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              <span className="text-slate-500">Name:</span> {viewingUser.firstName}{' '}
              {viewingUser.lastName}
            </p>
            <p>
              <span className="text-slate-500">Role:</span>{' '}
              {viewingUser.roles.map((r) => r.name.replace(/_/g, ' ')).join(', ')}
            </p>
            <p>
              <span className="text-slate-500">Department:</span>{' '}
              {viewingUser.department?.name ?? '—'}
            </p>
            <p>
              <span className="text-slate-500">Status:</span> {viewingUser.status}
            </p>
            <p>
              <span className="text-slate-500">Created:</span> {formatDate(viewingUser.createdAt)}
            </p>
            <p>
              <span className="text-slate-500">Updated:</span> {formatDate(viewingUser.updatedAt)}
            </p>
            <div>
              <p className="text-slate-500 mb-1">Inherited permissions</p>
              <div className="flex flex-wrap gap-1">
                {(viewingUser.permissions ?? []).map((permission) => (
                  <span
                    key={permission.id}
                    className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-emerald-400"
                  >
                    {permission.code}
                  </span>
                ))}
                {(viewingUser.permissions ?? []).length === 0 && (
                  <span className="text-xs text-slate-500">None</span>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isCreateRoleOpen}
        onClose={() => setIsCreateRoleOpen(false)}
        title="Create role"
        subtitle="Roles must use the system RoleName catalog."
      >
        <form onSubmit={(e) => void handleCreateRole(e)} className="space-y-3">
          <select
            value={createRoleName}
            onChange={(e) => setCreateRoleName(e.target.value as RoleName)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
          >
            {ROLE_OPTIONS.map((name) => (
              <option key={name} value={name}>
                {name.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <textarea
            value={createRoleDescription}
            onChange={(e) => setCreateRoleDescription(e.target.value)}
            placeholder="Description"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white min-h-20"
          />
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-semibold"
          >
            Create role
          </button>
        </form>
      </Modal>
    </div>
  );
}
