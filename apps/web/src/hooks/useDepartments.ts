import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type {
  Department,
  DepartmentQueryParams,
  CreateDepartmentInput,
  UpdateDepartmentInput,
  ApiListResponse,
  ApiSingleResponse,
} from '../types';

// ─── Query Key Factory ────────────────────────────────────────────────────────

export const departmentKeys = {
  all: ['departments'] as const,
  lists: () => [...departmentKeys.all, 'list'] as const,
  list: (params: DepartmentQueryParams) => [...departmentKeys.lists(), params] as const,
  details: () => [...departmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...departmentKeys.details(), id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetch a paginated, searchable list of departments.
 * GET /api/v1/departments
 */
export function useDepartments(params: DepartmentQueryParams = {}) {
  return useQuery<ApiListResponse<Department>>({
    queryKey: departmentKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<ApiListResponse<Department>>('/departments', { params });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a single department by ID (includes rooms list and _count).
 * GET /api/v1/departments/:id
 */
export function useDepartment(id: string) {
  return useQuery<ApiSingleResponse<Department>>({
    queryKey: departmentKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<ApiSingleResponse<Department>>('/departments/' + id);
      return data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Create a new department.
 * POST /api/v1/departments
 * Requires SUPER_ADMIN or CAMPUS_ADMIN.
 */
export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation<ApiSingleResponse<Department>, Error, CreateDepartmentInput>({
    mutationFn: async (payload) => {
      const { data } = await api.post<ApiSingleResponse<Department>>('/departments', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
    },
  });
}

/**
 * Update an existing department.
 * PATCH /api/v1/departments/:id
 * Requires SUPER_ADMIN, CAMPUS_ADMIN, or DEPARTMENT_ADMIN.
 */
export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiSingleResponse<Department>,
    Error,
    { id: string; data: UpdateDepartmentInput }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data } = await api.patch<ApiSingleResponse<Department>>(
        '/departments/' + id,
        payload,
      );
      return data;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: departmentKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}

/**
 * Hard-delete a department (SUPER_ADMIN only).
 * The backend prevents deletion if the department has rooms.
 * DELETE /api/v1/departments/:id
 */
export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete('/departments/' + id);
    },
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
      queryClient.removeQueries({ queryKey: departmentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}
