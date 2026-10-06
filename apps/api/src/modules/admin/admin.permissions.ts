import type { RoleName } from '../../types';

/** Canonical permission codes enforced by requirePermission(). */
export const PERMISSION_CATALOG = [
  { action: 'read', resource: 'users', description: 'View users' },
  { action: 'create', resource: 'users', description: 'Create users' },
  { action: 'update', resource: 'users', description: 'Update user profiles and roles' },
  { action: 'manage', resource: 'users', description: 'Activate, deactivate, and reset passwords' },
  { action: 'read', resource: 'roles', description: 'View roles' },
  { action: 'create', resource: 'roles', description: 'Create roles from the system catalog' },
  { action: 'update', resource: 'roles', description: 'Update role descriptions' },
  { action: 'manage', resource: 'roles', description: 'Delete roles and manage role lifecycle' },
  { action: 'read', resource: 'permissions', description: 'View permissions' },
  { action: 'manage', resource: 'permissions', description: 'Assign permissions to roles' },
  { action: 'read', resource: 'audit', description: 'View RBAC audit activity' },
  { action: 'view', resource: 'parking', description: 'View parking areas and slots' },
  { action: 'create', resource: 'parking', description: 'Create parking areas and slots' },
  { action: 'update', resource: 'parking', description: 'Update parking areas and slots' },
  { action: 'delete', resource: 'parking', description: 'Archive or delete parking resources' },
  { action: 'allocate', resource: 'parking', description: 'Allocate and release parking slots' },
  { action: 'manage', resource: 'parking', description: 'Full parking administration' },
  { action: 'view', resource: 'analytics', description: 'View campus-wide analytics' },
  { action: 'report', resource: 'analytics', description: 'Generate analytics reports' },
  { action: 'use', resource: 'ai', description: 'Use CampusVerse AI assistant' },
  { action: 'view', resource: 'announcement', description: 'View campus announcements' },
  { action: 'create', resource: 'announcement', description: 'Create announcements' },
  { action: 'update', resource: 'announcement', description: 'Update announcements' },
  { action: 'publish', resource: 'announcement', description: 'Publish or schedule announcements' },
  { action: 'delete', resource: 'announcement', description: 'Delete announcements' },
  { action: 'manage', resource: 'announcement', description: 'Full announcement administration' },
  { action: 'view', resource: 'digital_twin', description: 'View campus digital twin and intelligence' },
  { action: 'export', resource: 'digital_twin', description: 'Export digital twin data' },
  { action: 'view', resource: 'recommendation', description: 'View operational recommendations' },
  { action: 'manage', resource: 'recommendation', description: 'Acknowledge, dismiss, and resolve recommendations' },
  { action: 'view', resource: 'iot', description: 'View IoT devices and telemetry' },
  { action: 'manage', resource: 'iot', description: 'Register and manage IoT devices' },
  { action: 'ingest', resource: 'iot', description: 'Submit device telemetry' },
  { action: 'actions', resource: 'iot', description: 'Propose and approve operational actions' },
] as const;

export type PermissionCode =
  | 'users.read'
  | 'users.create'
  | 'users.update'
  | 'users.manage'
  | 'roles.read'
  | 'roles.create'
  | 'roles.update'
  | 'roles.manage'
  | 'permissions.read'
  | 'permissions.manage'
  | 'audit.read'
  | 'parking.view'
  | 'parking.create'
  | 'parking.update'
  | 'parking.delete'
  | 'parking.allocate'
  | 'parking.manage'
  | 'analytics.view'
  | 'analytics.report'
  | 'ai.use'
  | 'announcement.view'
  | 'announcement.create'
  | 'announcement.update'
  | 'announcement.publish'
  | 'announcement.delete'
  | 'announcement.manage'
  | 'digital_twin.view'
  | 'digital_twin.export'
  | 'recommendation.view'
  | 'recommendation.manage'
  | 'iot.view'
  | 'iot.manage'
  | 'iot.ingest'
  | 'iot.actions';

export function toPermissionCode(resource: string, action: string): string {
  return `${resource}.${action}`;
}

export const SYSTEM_ROLE_NAMES: RoleName[] = [
  'SUPER_ADMIN',
  'CAMPUS_ADMIN',
  'DEPARTMENT_ADMIN',
  'FACULTY',
  'STUDENT',
  'MAINTENANCE_STAFF',
  'SECURITY_STAFF',
];

export const ROLE_RANK: Record<RoleName, number> = {
  SUPER_ADMIN: 100,
  CAMPUS_ADMIN: 80,
  DEPARTMENT_ADMIN: 60,
  FACULTY: 40,
  MAINTENANCE_STAFF: 40,
  SECURITY_STAFF: 40,
  STUDENT: 20,
};

const ALL_PARKING: PermissionCode[] = [
  'parking.view',
  'parking.create',
  'parking.update',
  'parking.delete',
  'parking.allocate',
  'parking.manage',
];

const ALL_ANALYTICS: PermissionCode[] = ['analytics.view', 'analytics.report'];
const AI_USE: PermissionCode[] = ['ai.use'];
const ANNOUNCEMENT_VIEW: PermissionCode[] = ['announcement.view'];
const ALL_ANNOUNCEMENTS: PermissionCode[] = [
  'announcement.view',
  'announcement.create',
  'announcement.update',
  'announcement.publish',
  'announcement.delete',
  'announcement.manage',
];
const DEPT_ANNOUNCEMENTS: PermissionCode[] = [
  'announcement.view',
  'announcement.create',
  'announcement.update',
  'announcement.publish',
];

const ALL_DIGITAL_TWIN: PermissionCode[] = ['digital_twin.view', 'digital_twin.export'];
const ALL_RECOMMENDATIONS: PermissionCode[] = ['recommendation.view', 'recommendation.manage'];
const ALL_IOT: PermissionCode[] = ['iot.view', 'iot.manage', 'iot.ingest', 'iot.actions'];
const IOT_VIEW: PermissionCode[] = ['iot.view'];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, PermissionCode[]> = {
  SUPER_ADMIN: [
    'users.read',
    'users.create',
    'users.update',
    'users.manage',
    'roles.read',
    'roles.create',
    'roles.update',
    'roles.manage',
    'permissions.read',
    'permissions.manage',
    'audit.read',
    ...ALL_PARKING,
    ...ALL_ANALYTICS,
    ...AI_USE,
    ...ALL_ANNOUNCEMENTS,
    ...ALL_DIGITAL_TWIN,
    ...ALL_RECOMMENDATIONS,
    ...ALL_IOT,
  ],
  CAMPUS_ADMIN: [
    'users.read',
    'users.create',
    'users.update',
    'users.manage',
    'roles.read',
    'permissions.read',
    'audit.read',
    ...ALL_PARKING,
    ...ALL_ANALYTICS,
    ...AI_USE,
    ...ALL_ANNOUNCEMENTS,
    ...ALL_DIGITAL_TWIN,
    ...ALL_RECOMMENDATIONS,
    ...ALL_IOT,
  ],
  DEPARTMENT_ADMIN: [
    'users.read',
    'roles.read',
    'permissions.read',
    'parking.view',
    'analytics.view',
    'analytics.report',
    ...AI_USE,
    ...DEPT_ANNOUNCEMENTS,
    'digital_twin.view',
    'recommendation.view',
    ...IOT_VIEW,
  ],
  FACULTY: ['parking.view', 'analytics.view', ...AI_USE, ...ANNOUNCEMENT_VIEW, 'digital_twin.view', 'recommendation.view', ...IOT_VIEW],
  STUDENT: ['parking.view', ...AI_USE, ...ANNOUNCEMENT_VIEW],
  MAINTENANCE_STAFF: ['parking.view', 'parking.update', 'analytics.view', ...AI_USE, ...ANNOUNCEMENT_VIEW, 'digital_twin.view', 'recommendation.view', 'recommendation.manage', ...IOT_VIEW, 'iot.actions'],
  SECURITY_STAFF: ['parking.view', 'parking.allocate', 'parking.manage', 'analytics.view', ...AI_USE, ...ANNOUNCEMENT_VIEW, 'digital_twin.view', 'recommendation.view', ...IOT_VIEW, 'iot.actions'],
};

export function maxRoleRank(roles: RoleName[]): number {
  if (roles.length === 0) return 0;
  return Math.max(...roles.map((role) => ROLE_RANK[role] ?? 0));
}

export function canAssignRole(actorRoles: RoleName[], targetRole: RoleName): boolean {
  if (targetRole === 'SUPER_ADMIN') {
    return actorRoles.includes('SUPER_ADMIN');
  }
  return maxRoleRank(actorRoles) >= ROLE_RANK[targetRole];
}

export function isSystemRole(name: string): boolean {
  return (SYSTEM_ROLE_NAMES as string[]).includes(name);
}
