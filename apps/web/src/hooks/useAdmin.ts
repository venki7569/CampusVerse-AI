import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  AdminAuditEvent,
  AdminUser,
  ApiListResponse,
  ApiSingleResponse,
  CreateRoleInput,
  CreateUserInput,
  Permission,
  PermissionQueryParams,
  Role,
  RoleQueryParams,
  UpdateRoleInput,
  UpdateRolePermissionsInput,
  UpdateUserInput,
  UpdateUserStatusInput,
  UserQueryParams,
} from '../types';

export const adminKeys = {
  all: ['admin'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  userList: (params: UserQueryParams) => [...adminKeys.users(), 'list', params] as const,
  user: (id: string) => [...adminKeys.users(), 'detail', id] as const,
  roles: () => [...adminKeys.all, 'roles'] as const,
  roleList: (params: RoleQueryParams) => [...adminKeys.roles(), 'list', params] as const,
  role: (id: string) => [...adminKeys.roles(), 'detail', id] as const,
  permissions: () => [...adminKeys.all, 'permissions'] as const,
  permissionList: (params: PermissionQueryParams) =>
    [...adminKeys.permissions(), 'list', params] as const,
  permissionsByRole: (roleId: string) => [...adminKeys.permissions(), 'by-role', roleId] as const,
  audit: (params: Record<string, unknown>) => [...adminKeys.all, 'audit', params] as const,
  systemHealth: () => [...adminKeys.all, 'system-health'] as const,
};

export function useAdminUsers(params: UserQueryParams = {}, options?: { enabled?: boolean }) {
  return useQuery<ApiListResponse<AdminUser>>({
    queryKey: adminKeys.userList(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<AdminUser>>('/admin/users', { params });
      return data;
    },
    staleTime: 30 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useAdminUser(id: string) {
  return useQuery<ApiSingleResponse<AdminUser>>({
    queryKey: adminKeys.user(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<AdminUser>>(`/admin/users/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<AdminUser>, Error, CreateUserInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ApiSingleResponse<AdminUser>>('/admin/users', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<AdminUser>, Error, { id: string; data: UpdateUserInput }>({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.patch<ApiSingleResponse<AdminUser>>(`/admin/users/${id}`, payload);
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.user(variables.id) });
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiSingleResponse<AdminUser>,
    Error,
    { id: string; data: UpdateUserStatusInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.patch<ApiSingleResponse<AdminUser>>(
        `/admin/users/${id}/status`,
        payload,
      );
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminKeys.user(variables.id) });
    },
  });
}

export function useResetAdminUserPassword() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<AdminUser>, Error, { id: string; password: string }>({
    mutationFn: async ({ id, password }) => {
      const { data } = await api.patch<ApiSingleResponse<AdminUser>>(`/admin/users/${id}/password`, {
        password,
      });
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.user(variables.id) });
    },
  });
}

export function useRoles(params: RoleQueryParams = {}) {
  return useQuery<ApiListResponse<Role>>({
    queryKey: adminKeys.roleList(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<Role>>('/admin/roles', { params });
      return data;
    },
    staleTime: 60 * 1000,
  });
}

export function useRole(id: string) {
  return useQuery<ApiSingleResponse<Role>>({
    queryKey: adminKeys.role(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<Role>>(`/admin/roles/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<Role>, Error, CreateRoleInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ApiSingleResponse<Role>>('/admin/roles', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.roles() });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation<ApiSingleResponse<Role>, Error, { id: string; data: UpdateRoleInput }>({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.patch<ApiSingleResponse<Role>>(`/admin/roles/${id}`, payload);
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.roles() });
      queryClient.invalidateQueries({ queryKey: adminKeys.role(variables.id) });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/admin/roles/${id}`);
    },
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.roles() });
      queryClient.removeQueries({ queryKey: adminKeys.role(id) });
    },
  });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiSingleResponse<Role>,
    Error,
    { roleId: string; data: UpdateRolePermissionsInput }
  >({
    mutationFn: async ({ roleId, data: payload }) => {
      const { data } = await api.put<ApiSingleResponse<Role>>(
        `/admin/roles/${roleId}/permissions`,
        payload,
      );
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.roles() });
      queryClient.invalidateQueries({ queryKey: adminKeys.role(variables.roleId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.permissions() });
      queryClient.invalidateQueries({ queryKey: adminKeys.permissionsByRole(variables.roleId) });
    },
  });
}

export function usePermissions(params: PermissionQueryParams = {}) {
  return useQuery<ApiListResponse<Permission>>({
    queryKey: adminKeys.permissionList(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<Permission>>('/admin/permissions', { params });
      return data;
    },
    staleTime: 60 * 1000,
  });
}

export function useAdminAudit(params: { page?: number; limit?: number; action?: string } = {}) {
  return useQuery<ApiListResponse<AdminAuditEvent>>({
    queryKey: adminKeys.audit(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<AdminAuditEvent>>('/admin/audit', { params });
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export interface SystemHealthReport {
  status: 'ready' | 'degraded' | 'not_ready';
  timestamp: string;
  uptime: number;
  env: string;
  version: string;
  dependencies: Record<string, { status: string; latencyMs?: number }>;
}

export function useSystemHealth(options?: { enabled?: boolean }) {
  return useQuery<ApiSingleResponse<SystemHealthReport>>({
    queryKey: adminKeys.systemHealth(),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<SystemHealthReport>>('/admin/system-health');
      return data;
    },
    staleTime: 15 * 1000,
    enabled: options?.enabled ?? true,
  });
}
