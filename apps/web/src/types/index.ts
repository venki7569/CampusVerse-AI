// ─── Shared Enums (mirror Prisma enums) ────────────────────────────────────

export type OperationalStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'UNDER_MAINTENANCE'
  | 'DAMAGED'
  | 'RETIRED';

export type RoomOccupancyStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'UNDER_MAINTENANCE'
  | 'RESERVED';

export type RoleName =
  | 'SUPER_ADMIN'
  | 'CAMPUS_ADMIN'
  | 'DEPARTMENT_ADMIN'
  | 'FACULTY'
  | 'STUDENT'
  | 'MAINTENANCE_STAFF'
  | 'SECURITY_STAFF';

// ─── Pagination ─────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiListResponse<T> {
  success: true;
  data: T[];
  meta: { pagination: PaginationMeta };
}

export interface ApiSingleResponse<T> {
  success: true;
  data: T;
  meta: Record<string, unknown>;
}

// ─── Query Params ────────────────────────────────────────────────────────────

export interface BuildingQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface FloorQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  buildingId?: string;
}

export interface RoomQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  buildingId?: string;
  floorId?: string;
  departmentId?: string;
  roomType?: string;
  operationalStatus?: OperationalStatus;
  occupancyStatus?: RoomOccupancyStatus;
}

// ─── Domain Types ────────────────────────────────────────────────────────────

export interface Building {
  id: string;
  code: string;
  name: string;
  location: string | null;
  coordinates: string | null;
  operationalStatus: OperationalStatus;
  createdAt: string;
  updatedAt: string;
  // Relations (present when fetching with includes)
  floors?: Floor[];
  _count?: { floors: number; assets: number };
}

export interface Floor {
  id: string;
  level: string;
  buildingId: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  building?: Building;
  rooms?: Room[];
  _count?: { rooms: number };
}

export interface Department {
  id: string;
  code: string;
  name: string;
  headName: string | null;
  contactInfo: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations (present on detail endpoint)
  rooms?: Pick<Room, 'id' | 'roomNumber' | 'roomType' | 'capacity'>[];
  _count?: { rooms: number; assets: number };
}

export interface Room {
  id: string;
  roomNumber: string;
  floorId: string;
  departmentId: string | null;
  capacity: number;
  roomType: string;
  operationalStatus: OperationalStatus;
  occupancyStatus: RoomOccupancyStatus;
  createdAt: string;
  updatedAt: string;
  // Relations
  floor?: Floor;
  department?: Department | null;
}

// ─── Input DTOs (mirror backend contract) ───────────────────────────────────

export interface CreateBuildingInput {
  code: string;
  name: string;
  location?: string;
  coordinates?: string;
  operationalStatus?: OperationalStatus;
}

export interface UpdateBuildingInput {
  name?: string;
  location?: string;
  coordinates?: string;
  operationalStatus?: OperationalStatus;
}

export interface CreateFloorInput {
  level: string;
  buildingId: string;
}

export interface UpdateFloorInput {
  level?: string;
}

export interface CreateRoomInput {
  roomNumber: string;
  floorId: string;
  departmentId?: string;
  capacity?: number;
  roomType: string;
  operationalStatus?: OperationalStatus;
  occupancyStatus?: RoomOccupancyStatus;
}

export interface UpdateRoomInput {
  roomNumber?: string;
  departmentId?: string | null;
  capacity?: number;
  roomType?: string;
  operationalStatus?: OperationalStatus;
  occupancyStatus?: RoomOccupancyStatus;
}

// ─── Department Inputs ────────────────────────────────────────────────────────

export interface CreateDepartmentInput {
  code: string;
  name: string;
  headName?: string | null;
  contactInfo?: string | null;
}

export interface UpdateDepartmentInput {
  name?: string;
  headName?: string | null;
  contactInfo?: string | null;
}

export interface DepartmentQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── Asset Types ─────────────────────────────────────────────────────────────

export type AssetCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';

export interface AssetCategory {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceHistory {
  id: string;
  assetId: string;
  action: string;
  technicianId: string | null;
  cost: number | null;
  notes: string | null;
  performedAt: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  categoryId: string;
  vendorId: string | null;
  departmentId: string | null;
  buildingId: string | null;
  roomId: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchaseCost: number | null;
  warrantyExpiry: string | null;
  condition: AssetCondition | null;
  operationalStatus: OperationalStatus;
  lastMaintenance: string | null;
  nextMaintenance: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  category?: AssetCategory;
  vendor?: Vendor | null;
  department?: { id: string; name: string; code: string } | null;
  building?: { id: string; name: string; code: string } | null;
  room?: {
    id: string;
    roomNumber: string;
    roomType: string;
    floor?: {
      id: string;
      level: string;
      building?: { id: string; name: string; code: string };
    };
  } | null;
  maintenanceHistory?: MaintenanceHistory[];
}

export interface AssetQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  categoryId?: string;
  departmentId?: string;
  buildingId?: string;
  roomId?: string;
  condition?: AssetCondition;
  operationalStatus?: OperationalStatus;
}

export interface CreateAssetInput {
  assetTag: string;
  name: string;
  categoryId: string;
  vendorId?: string | null;
  departmentId?: string | null;
  buildingId?: string | null;
  roomId?: string | null;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  purchaseCost?: number | null;
  warrantyExpiry?: string | null;
  condition?: AssetCondition | null;
  operationalStatus?: OperationalStatus;
  lastMaintenance?: string | null;
  nextMaintenance?: string | null;
}

export interface UpdateAssetInput {
  assetTag?: string;
  name?: string;
  categoryId?: string;
  vendorId?: string | null;
  departmentId?: string | null;
  buildingId?: string | null;
  roomId?: string | null;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  purchaseCost?: number | null;
  warrantyExpiry?: string | null;
  condition?: AssetCondition | null;
  operationalStatus?: OperationalStatus;
  lastMaintenance?: string | null;
  nextMaintenance?: string | null;
}

// ─── Maintenance Types ───────────────────────────────────────────────────────

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type MaintenanceStatus =
  | 'REPORTED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REJECTED'
  | 'CANCELLED';

export type MaintenanceCategory =
  | 'ELECTRICAL'
  | 'PLUMBING'
  | 'HVAC'
  | 'NETWORK'
  | 'IT_EQUIPMENT'
  | 'FURNITURE'
  | 'CLEANING'
  | 'CIVIL'
  | 'SAFETY'
  | 'OTHER';

export interface MaintenanceComment {
  id: string;
  requestId: string;
  authorId: string;
  content: string;
  createdAt: string;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface MaintenanceAssignment {
  id: string;
  requestId: string;
  technicianId: string;
  assignedAt: string;
  technician?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  categoryId: MaintenanceCategory | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  images: string[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reporterId: string;
  roomId: string | null;
  assetId: string | null;
  // Relations
  reporter?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  room?: {
    id: string;
    roomNumber: string;
    roomType: string;
    floor?: {
      id: string;
      level: string;
      building?: { id: string; name: string; code: string };
    };
    department?: { id: string; name: string; code: string } | null;
  } | null;
  asset?: {
    id: string;
    assetTag: string;
    name: string;
    operationalStatus: OperationalStatus;
    category?: { id: string; name: string };
  } | null;
  assignments?: MaintenanceAssignment[];
  comments?: MaintenanceComment[];
  _count?: {
    comments: number;
  };
}

export interface MaintenanceQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
  categoryId?: MaintenanceCategory;
  buildingId?: string;
  roomId?: string;
  assetId?: string;
  technicianId?: string;
  reporterId?: string;
}

export interface CreateMaintenanceRequestInput {
  title: string;
  description: string;
  categoryId?: MaintenanceCategory | null;
  priority?: MaintenancePriority;
  buildingId?: string | null;
  roomId?: string | null;
  assetId?: string | null;
  images?: string[];
}

export interface UpdateMaintenanceRequestInput {
  title?: string;
  description?: string;
  categoryId?: MaintenanceCategory | null;
  priority?: MaintenancePriority;
  buildingId?: string | null;
  roomId?: string | null;
  assetId?: string | null;
  images?: string[];
}

export interface AssignMaintenanceRequestInput {
  technicianId: string;
}

export interface ResolveMaintenanceRequestInput {
  resolutionNotes: string;
  cost?: number | null;
}

export interface CloseMaintenanceRequestInput {
  notes?: string;
}

export interface CancelOrRejectMaintenanceRequestInput {
  reason: string;
}

export interface CreateMaintenanceCommentInput {
  content: string;
}

export interface MaintenanceMetrics {
  total: number;
  reported: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  closed: number;
  critical: number;
}
// Utility & Meter types
export interface ElectricityMeter {
  id: string;
  serialNumber: string;
  buildingId: string | null;
  departmentId: string | null;
  isActive: boolean;
  createdAt: string;
  building?: { id: string; name: string; code: string } | null;
  department?: { id: string; name: string; code: string } | null;
  _count?: { readings: number };
}

export interface ElectricityReading {
  id: string;
  meterId: string;
  kwhConsumption: number;
  readingTime: string;
  createdAt: string;
}

export interface WaterMeter {
  id: string;
  serialNumber: string;
  buildingId: string | null;
  isActive: boolean;
  createdAt: string;
  building?: { id: string; name: string; code: string } | null;
  _count?: { readings: number };
}

export interface WaterReading {
  id: string;
  meterId: string;
  litersConsumption: number;
  readingTime: string;
  createdAt: string;
}

export interface UtilityConsumption {
  period: string;
  consumption: number;
}

export interface UtilityAnomaly {
  id: string;
  meterId: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  observedValue: number;
  expectedValue: number;
  message: string;
  detectedAt: string;
  resolvedAt: string | null;
}

export interface CreateElectricityMeterInput {
  serialNumber: string;
  buildingId?: string | null;
  departmentId?: string | null;
  isActive?: boolean;
}

export interface UpdateElectricityMeterInput {
  serialNumber?: string;
  buildingId?: string | null;
  departmentId?: string | null;
  isActive?: boolean;
}

export interface CreateElectricityReadingInput {
  kwhConsumption: number;
  readingTime: string;
}

export interface CreateWaterMeterInput {
  serialNumber: string;
  buildingId?: string | null;
  isActive?: boolean;
}

export interface UpdateWaterMeterInput {
  serialNumber?: string;
  buildingId?: string | null;
  isActive?: boolean;
}

export interface CreateWaterReadingInput {
  litersConsumption: number;
  readingTime: string;
}

export interface ElectricityQueryParams {
  page?: number;
  limit?: number;
  buildingId?: string;
  departmentId?: string;
  isActive?: boolean;
  search?: string;
}

export interface WaterQueryParams {
  page?: number;
  limit?: number;
  buildingId?: string;
  isActive?: boolean;
  search?: string;
}

export interface UtilityAnalyticsQueryParams {
  from?: string;
  to?: string;
  buildingId?: string;
  departmentId?: string;
  meterId?: string;
  groupBy?: 'day' | 'week' | 'month' | 'meter' | 'building' | 'department';
}

// ─── Dashboard Types ─────────────────────────────────────────────────────────

export interface DashboardQueryParams {
  from?: string;
  to?: string;
  buildingId?: string;
  departmentId?: string;
  floorId?: string;
}

export interface OccupancySummary {
  total: number;
  occupied: number;
  available: number;
  reserved: number;
  underMaintenance: number;
  occupancyRate: number | null;
  hasData: boolean;
}

export interface BuildingOccupancy {
  buildingId: string;
  code: string;
  name: string;
  total: number;
  occupied: number;
  available: number;
  reserved: number;
  underMaintenance: number;
  occupancyRate: number | null;
}

export interface BuildingPerformanceRow {
  buildingId: string;
  code: string;
  name: string;
  rooms: number;
  occupancyRate: number | null;
  electricity: number | null;
  water: number | null;
}

export interface UtilitySeriesPoint {
  period: string;
  consumption: number;
}

export interface UtilityBuildingPoint {
  id: string;
  label: string;
  consumption: number;
}

export interface EnergySummary {
  available: boolean;
  unit: 'kWh';
  latest: number | null;
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
  trend: UtilitySeriesPoint[];
  byBuilding: UtilityBuildingPoint[];
}

export interface WaterSummary {
  available: boolean;
  unit: 'L';
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
  trend: UtilitySeriesPoint[];
  byBuilding: UtilityBuildingPoint[];
}

export interface MaintenancePriorityItem {
  id: string;
  title: string;
  priority: string;
  status: string;
  createdAt: string;
  roomNumber: string | null;
  buildingName: string | null;
}

export interface MaintenanceSummary {
  total: number;
  reported: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  closed: number;
  cancelled: number;
  rejected: number;
  open: number;
  critical: number;
  averageResolutionHours: number | null;
  highPriorityOpen: MaintenancePriorityItem[];
}

export interface AssetDistributionItem {
  status: string;
  count: number;
  percent: number | null;
}

export interface AssetHealthSummary {
  total: number;
  active: number;
  inactive: number;
  underMaintenance: number;
  damaged: number;
  retired: number;
  distribution: AssetDistributionItem[];
}

export interface DashboardKpis {
  buildings: number;
  departments: number;
  rooms: number;
  classrooms: number;
  laboratories: number;
  assets: number;
  openMaintenance: number;
  occupiedRooms: number;
  availableRooms: number;
  occupancyRate: number | null;
  parkingAreas: number;
  parkingSlots: number;
  parkingAvailable: number;
  parkingUtilization: number | null;
}

export interface RecentActivity {
  id: string;
  module: string;
  action: string;
  message: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  entityId?: string;
}

export interface DashboardAlertItem {
  id: string;
  title: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
  link?: string;
}

export interface DashboardOverview {
  kpis: DashboardKpis;
  occupancy: OccupancySummary;
  parking: ParkingAvailability;
  buildingOccupancy: BuildingOccupancy[];
  energy: {
    electricity: EnergySummary;
    water: WaterSummary;
  };
  maintenance: MaintenanceSummary;
  assets: AssetHealthSummary;
  buildingPerformance: BuildingPerformanceRow[];
  recentActivity: RecentActivity[];
  alerts: {
    criticalMaintenance: MaintenancePriorityItem[];
    energyAnomalies: DashboardAlertItem[];
    waterAnomalies: DashboardAlertItem[];
  };
  filtersApplied: DashboardQueryParams;
}

export interface UpdateOccupancyInput {
  occupancyStatus: RoomOccupancyStatus;
  source?: 'MANUAL' | 'SIMULATED' | 'IOT_SENSOR';
  reason?: string;
}

// ─── Notification Types ──────────────────────────────────────────────────────

export type NotificationType =
  | 'MAINTENANCE_UPDATE'
  | 'MAINTENANCE_ASSIGNED'
  | 'MAINTENANCE_RESOLVED'
  | 'MAINTENANCE_COMMENT'
  | 'UTILITY_ANOMALY'
  | 'SYSTEM'
  | string;

export type NotificationSeverity =
  | 'INFO'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'
  | 'SUCCESS'
  | 'WARNING';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  severity: NotificationSeverity | string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  unreadOnly?: boolean;
  type?: string;
  severity?: NotificationSeverity;
}

export interface UnreadNotificationCount {
  unreadCount: number;
}

export type NotificationListResponse = ApiListResponse<AppNotification>;

// ─── Admin / RBAC Types ──────────────────────────────────────────────────────

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface AdminRoleSummary {
  id: string;
  name: RoleName | string;
  description: string | null;
}

export interface AdminPermissionSummary {
  id: string;
  code: string;
  action: string;
  resource: string;
  description: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  status: UserStatus;
  departmentId: string | null;
  department: { id: string; code: string; name: string } | null;
  roles: AdminRoleSummary[];
  permissions?: AdminPermissionSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: RoleName | string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
  permissions?: AdminPermissionSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  code: string;
  action: string;
  resource: string;
  description: string | null;
  assignedRoles: Array<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermission {
  roleId: string;
  permissionId: string;
}

export interface UserQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  roleId?: string;
  departmentId?: string;
  status?: UserStatus;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleId?: string;
  roleName?: RoleName;
  departmentId?: string | null;
  isActive?: boolean;
  status?: UserStatus;
}

export interface UpdateUserInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  roleId?: string;
  roleName?: RoleName;
  departmentId?: string | null;
  isActive?: boolean;
  status?: UserStatus;
  password?: string;
}

export interface UpdateUserStatusInput {
  isActive?: boolean;
  status?: UserStatus;
}

export interface RoleQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PermissionQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  resource?: string;
}

export interface AdminAuditEvent {
  id: string;
  actorId: string;
  action: string;
  entityName: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateRoleInput {
  name: RoleName;
  description?: string | null;
}

export interface UpdateRoleInput {
  description?: string | null;
}

export interface UpdateRolePermissionsInput {
  permissionIds: string[];
}

// ─── Parking Types ───────────────────────────────────────────────────────────

export type ParkingSlotStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'UNDER_MAINTENANCE';
export type ParkingSlotType = 'STANDARD' | 'HANDICAP' | 'EV' | 'MOTORCYCLE' | 'VISITOR';

export interface ParkingSlotCounts {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  underMaintenance: number;
}

export interface ParkingArea {
  id: string;
  name: string;
  location: string | null;
  buildingId: string | null;
  totalSlots: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  building?: { id: string; code: string; name: string } | null;
  slotCounts?: ParkingSlotCounts;
  _count?: { slots: number };
}

export interface ParkingSlot {
  id: string;
  areaId: string;
  slotNumber: string;
  slotType: string;
  status: string;
  reservedForId: string | null;
  createdAt: string;
  updatedAt: string;
  area?: {
    id: string;
    name: string;
    location: string | null;
    buildingId: string | null;
    isActive: boolean;
    building?: { id: string; code: string; name: string } | null;
  };
  reservedFor?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface CreateParkingAreaInput {
  name: string;
  location?: string | null;
  buildingId?: string | null;
  isActive?: boolean;
}

export interface UpdateParkingAreaInput {
  name?: string;
  location?: string | null;
  buildingId?: string | null;
  isActive?: boolean;
}

export interface CreateParkingSlotInput {
  areaId: string;
  slotNumber: string;
  slotType?: ParkingSlotType;
  status?: ParkingSlotStatus;
}

export interface UpdateParkingSlotInput {
  slotNumber?: string;
  slotType?: ParkingSlotType;
  status?: ParkingSlotStatus;
}

export interface AllocateParkingSlotInput {
  userId: string;
  status?: 'OCCUPIED' | 'RESERVED';
}

export interface ParkingQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  buildingId?: string;
  areaId?: string;
  isActive?: boolean;
  status?: ParkingSlotStatus;
  slotType?: ParkingSlotType;
  reservedForId?: string;
}

export interface ParkingAvailability {
  areas: number;
  activeAreas: number;
  totalSlots: number;
  available: number;
  occupied: number;
  reserved: number;
  underMaintenance: number;
  utilizationPercent: number | null;
  byArea?: Array<{
    areaId: string;
    name: string;
    isActive: boolean;
    total: number;
    available: number;
    occupied: number;
    reserved: number;
    underMaintenance: number;
    utilizationPercent: number | null;
  }>;
}

export type ParkingMetrics = ParkingAvailability;

// ─── Analytics Types ─────────────────────────────────────────────────────────

export type AnalyticsDatePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'last90days'
  | 'currentMonth'
  | 'previousMonth'
  | 'custom';

export interface AnalyticsQueryParams {
  preset?: AnalyticsDatePreset;
  from?: string;
  to?: string;
  buildingId?: string;
  departmentId?: string;
  floorId?: string;
  granularity?: 'daily' | 'weekly' | 'monthly';
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  category?: AnalyticsReportCategory;
}

export type AnalyticsReportCategory =
  | 'campus_overview'
  | 'utilities'
  | 'maintenance'
  | 'assets'
  | 'occupancy'
  | 'parking'
  | 'building_performance';

export interface AnalyticsDateRange {
  from: string;
  to: string;
  preset: string;
}

export interface AnalyticsOverview {
  kpis: {
    buildings: number;
    activeBuildings: number;
    floors: number;
    rooms: number;
    availableRooms: number;
    occupiedRooms: number;
    reservedRooms: number;
    roomsUnderMaintenance: number;
    occupancyRate: number | null;
    assets: number;
    activeAssets: number;
    assetsUnderMaintenance: number;
    openMaintenance: number;
    resolvedMaintenance: number;
    electricityConsumptionKwh: number | null;
    waterConsumptionLiters: number | null;
    parkingCapacity: number;
    parkingAvailable: number;
    parkingAllocated: number;
    parkingUtilization: number | null;
    unreadAlerts: number;
  };
  dateRange: AnalyticsDateRange;
  filtersApplied: {
    buildingId?: string;
    departmentId?: string;
    floorId?: string;
  };
}

export interface TrendSeriesPoint {
  period: string;
  value: number;
}

export interface AnalyticsTrends {
  electricity: {
    unit: 'kWh';
    daily: TrendSeriesPoint[];
    weekly: TrendSeriesPoint[];
    monthly: TrendSeriesPoint[];
  };
  water: {
    unit: 'L';
    daily: TrendSeriesPoint[];
    weekly: TrendSeriesPoint[];
    monthly: TrendSeriesPoint[];
  };
  maintenance: Array<{
    period: string;
    reported: number;
    assigned: number;
    inProgress: number;
    resolved: number;
    closed: number;
    cancelled: number;
    rejected: number;
  }>;
  occupancy: Array<{
    period: string;
    available: number;
    occupied: number;
    reserved: number;
    underMaintenance: number;
  }>;
  parking: Array<{
    period: string;
    totalCapacity: number;
    available: number;
    allocated: number;
    utilizationPercent: number | null;
  }>;
  dateRange: AnalyticsDateRange;
}

export interface BuildingAnalytics {
  buildingId: string;
  code: string;
  name: string;
  rooms: number;
  occupiedRooms: number;
  occupancyRate: number | null;
  assets: number;
  maintenanceIssues: number;
  electricityKwh: number | null;
  waterLiters: number | null;
  parkingCapacity: number;
  parkingUtilization: number | null;
}

export interface DepartmentAnalytics {
  departmentId: string;
  code: string;
  name: string;
  rooms: number;
  assets: number;
  maintenanceIssues: number;
  electricityMeters: number;
  electricityKwh: number | null;
  openMaintenance: number;
}

export interface AssetAnalytics {
  total: number;
  byCategory: Array<{ categoryId: string; name: string; count: number }>;
  byCondition: Array<{ condition: string; count: number }>;
  byOperationalStatus: Array<{ status: string; count: number }>;
  byBuilding: Array<{ buildingId: string; name: string; count: number }>;
  byDepartment: Array<{ departmentId: string; name: string; count: number }>;
  underMaintenance: number;
  retired: number;
  warrantyExpiringSoon: number;
}

export interface MaintenanceAnalytics {
  total: number;
  reported: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  closed: number;
  cancelled: number;
  rejected: number;
  averageResolutionHours: number | null;
  byCategory: Array<{ categoryId: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  byBuilding: Array<{ buildingId: string; name: string; count: number }>;
  byDepartment: Array<{ departmentId: string; name: string; count: number }>;
  assetRelated: number;
  technicianWorkload: Array<{ technicianId: string; name: string; assignments: number }>;
}

export interface OccupancyAnalytics {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  underMaintenance: number;
  occupancyRate: number | null;
  byBuilding: Array<{
    buildingId: string;
    code: string;
    name: string;
    total: number;
    occupied: number;
    occupancyRate: number | null;
  }>;
  byFloor: Array<{
    floorId: string;
    level: string;
    buildingName: string;
    total: number;
    occupied: number;
    occupancyRate: number | null;
  }>;
}

export interface ParkingAnalyticsData {
  areas: number;
  activeAreas: number;
  totalSlots: number;
  available: number;
  allocated: number;
  utilizationPercent: number | null;
  byType: Array<{ slotType: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  byBuilding: Array<{
    buildingId: string;
    name: string;
    total: number;
    available: number;
    allocated: number;
    utilizationPercent: number | null;
  }>;
}

export interface UtilityAnalytics {
  electricity: {
    unit: 'kWh';
    total: number | null;
    byBuilding: Array<{ buildingId: string; name: string; consumption: number }>;
    byDepartment: Array<{ departmentId: string; name: string; consumption: number }>;
    dailyTrend: TrendSeriesPoint[];
    monthlyTrend: TrendSeriesPoint[];
    anomalyCount: number;
  };
  water: {
    unit: 'L';
    total: number | null;
    byBuilding: Array<{ buildingId: string; name: string; consumption: number }>;
    dailyTrend: TrendSeriesPoint[];
    monthlyTrend: TrendSeriesPoint[];
    anomalyCount: number;
  };
  dateRange: AnalyticsDateRange;
}

export interface AnalyticsReport {
  category: AnalyticsReportCategory;
  generatedAt: string;
  dateRange: AnalyticsDateRange;
  data: Record<string, unknown>;
}

export type AnalyticsTrend = AnalyticsTrends;

// ─── AI Assistant ────────────────────────────────────────────────────────────

export interface AISourceReference {
  type: string;
  label: string;
  period?: string;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface AIChatRequest {
  conversationId?: string;
  message: string;
}

export interface AIChatResponse {
  conversationId: string;
  message: AIMessage;
  sources: AISourceReference[];
  configured: boolean;
}

export interface AIConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AIConversationDetail {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AIStatus {
  configured: boolean;
}

// ─── Announcements ───────────────────────────────────────────────────────────

export type AnnouncementStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'EXPIRED'
  | 'ARCHIVED'
  | 'CANCELLED';

export type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type AnnouncementCategory =
  | 'GENERAL'
  | 'ACADEMIC'
  | 'EXAMINATION'
  | 'EVENT'
  | 'MAINTENANCE'
  | 'EMERGENCY'
  | 'TRANSPORT'
  | 'FACILITY'
  | 'SECURITY'
  | 'OTHER';

export type AnnouncementAudienceType = 'ALL' | 'ROLE' | 'DEPARTMENT' | 'BUILDING' | 'USER';

export interface AnnouncementAuthor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  audienceType: AnnouncementAudienceType;
  targetRole: RoleName | null;
  targetDepartmentId: string | null;
  targetBuildingId: string | null;
  targetUserId: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: AnnouncementAuthor;
  targetDepartment?: { id: string; code: string; name: string } | null;
  targetBuilding?: { id: string; code: string; name: string } | null;
  isRead?: boolean;
}

export interface AnnouncementQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: AnnouncementStatus;
  category?: AnnouncementCategory;
  priority?: AnnouncementPriority;
  unreadOnly?: boolean;
  adminView?: boolean;
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  category?: AnnouncementCategory;
  priority?: AnnouncementPriority;
  audienceType?: AnnouncementAudienceType;
  targetRole?: RoleName;
  targetDepartmentId?: string;
  targetBuildingId?: string;
  targetUserId?: string;
  scheduledAt?: string;
  expiresAt?: string;
}

export type UpdateAnnouncementInput = Partial<CreateAnnouncementInput>;

export interface ScheduleAnnouncementInput {
  scheduledAt: string;
  expiresAt?: string;
}

export interface UnreadAnnouncementCount {
  unreadCount: number;
}

export interface AnnouncementFeedSummary {
  unreadCount: number;
  urgentCount: number;
  latest: Announcement[];
}

