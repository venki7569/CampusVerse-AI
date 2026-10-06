import type {
  Announcement,
  AnnouncementAudienceType,
  AnnouncementStatus,
  RoleName,
} from '@prisma/client';

export type AnnouncementViewer = {
  id: string;
  departmentId: string | null;
  roles: RoleName[];
  buildingIds?: string[];
};

export type AnnouncementRecord = Pick<
  Announcement,
  | 'status'
  | 'audienceType'
  | 'targetRole'
  | 'targetDepartmentId'
  | 'targetBuildingId'
  | 'targetUserId'
  | 'scheduledAt'
  | 'publishedAt'
  | 'expiresAt'
>;

export function isAnnouncementExpired(announcement: AnnouncementRecord, now = new Date()): boolean {
  return Boolean(announcement.expiresAt && announcement.expiresAt <= now);
}

export function isAnnouncementVisibleToUser(
  announcement: AnnouncementRecord,
  viewer: AnnouncementViewer,
  now = new Date(),
): boolean {
  if (announcement.status === 'DRAFT' || announcement.status === 'ARCHIVED' || announcement.status === 'CANCELLED') {
    return false;
  }

  if (announcement.status === 'EXPIRED') {
    return false;
  }

  if (isAnnouncementExpired(announcement, now)) {
    return false;
  }

  if (announcement.status === 'SCHEDULED') {
    if (!announcement.scheduledAt || announcement.scheduledAt > now) {
      return false;
    }
  } else if (announcement.status !== 'PUBLISHED') {
    return false;
  }

  return matchesAudience(announcement, viewer);
}

export function matchesAudience(announcement: AnnouncementRecord, viewer: AnnouncementViewer): boolean {
  const type: AnnouncementAudienceType = announcement.audienceType;

  switch (type) {
    case 'ALL':
      return true;
    case 'ROLE':
      return announcement.targetRole ? viewer.roles.includes(announcement.targetRole) : false;
    case 'DEPARTMENT':
      return Boolean(
        announcement.targetDepartmentId &&
          viewer.departmentId &&
          announcement.targetDepartmentId === viewer.departmentId,
      );
    case 'BUILDING':
      if (!announcement.targetBuildingId) return false;
      return (viewer.buildingIds ?? []).includes(announcement.targetBuildingId);
    case 'USER':
      return announcement.targetUserId === viewer.id;
    default:
      return false;
  }
}

const VALID_TRANSITIONS: Record<AnnouncementStatus, AnnouncementStatus[]> = {
  DRAFT: ['SCHEDULED', 'PUBLISHED', 'ARCHIVED'],
  SCHEDULED: ['PUBLISHED', 'CANCELLED', 'ARCHIVED'],
  PUBLISHED: ['ARCHIVED', 'EXPIRED'],
  EXPIRED: [],
  ARCHIVED: [],
  CANCELLED: [],
};

export function canTransitionStatus(from: AnnouncementStatus, to: AnnouncementStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function priorityToNotificationSeverity(priority: string): string {
  switch (priority) {
    case 'URGENT':
      return 'URGENT';
    case 'HIGH':
      return 'HIGH';
    case 'LOW':
      return 'LOW';
    default:
      return 'NORMAL';
  }
}
