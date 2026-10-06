import React, { useMemo, useState } from 'react';
import { useAuth } from '../store/authContext';
import { useDashboard } from '../hooks/useDashboard';
import { useBuildings } from '../hooks/useBuildings';
import { useDepartments } from '../hooks/useDepartments';
import { useUnreadNotificationCount } from '../hooks/useNotifications';
import { useDigitalTwinOverview } from '../hooks/useDigitalTwin';
import { Link, useNavigate } from 'react-router-dom';
import { KpiCard } from '../components/ui/KpiCard';
import { DataTable, type Column } from '../components/ui/DataTable';
import { ChartContainer } from '../components/ui/ChartContainer';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { CardSkeleton, TableSkeleton } from '../components/ui/Skeleton';
import {
  Building2,
  Boxes,
  Wrench,
  DoorOpen,
  Layers,
  School,
  FlaskConical,
  Users,
  RefreshCw,
  Zap,
  Droplet,
  Activity,
  AlertTriangle,
  Bell,
  Car,
  BarChart3,
  Bot,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import type {
  BuildingOccupancy,
  BuildingPerformanceRow,
  DashboardQueryParams,
  RecentActivity,
} from '../types';

const PIE_COLORS = ['#10b981', '#64748b', '#f59e0b', '#06b6d4'];

function formatNumber(value: number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString()}${suffix}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value}%`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [buildingId, setBuildingId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params: DashboardQueryParams = useMemo(
    () => ({
      buildingId: buildingId || undefined,
      departmentId: departmentId || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    }),
    [buildingId, departmentId, from, to],
  );

  const { data, isLoading, isError, refetch, isFetching } = useDashboard(params);
  const { data: buildingsData } = useBuildings({ limit: 100 });
  const { data: departmentsData } = useDepartments({ limit: 100, sortBy: 'name', sortOrder: 'asc' });
  const { data: unreadData } = useUnreadNotificationCount();
  const twinQuery = useDigitalTwinOverview();
  const unreadCount = unreadData?.data.unreadCount ?? 0;

  const overview = data?.data;
  const buildings = buildingsData?.data ?? [];
  const departments = departmentsData?.data ?? [];

  const occupancyChart = overview
    ? [
        { name: 'Occupied', value: overview.occupancy.occupied },
        { name: 'Available', value: overview.occupancy.available },
        { name: 'Reserved', value: overview.occupancy.reserved },
        { name: 'Maintenance', value: overview.occupancy.underMaintenance },
      ].filter((item) => item.value > 0)
    : [];

  const maintenanceChart = overview
    ? [
        { name: 'Reported', value: overview.maintenance.reported },
        { name: 'Assigned', value: overview.maintenance.assigned },
        { name: 'In Progress', value: overview.maintenance.inProgress },
        { name: 'Resolved', value: overview.maintenance.resolved },
        { name: 'Closed', value: overview.maintenance.closed },
        { name: 'Cancelled', value: overview.maintenance.cancelled },
        { name: 'Rejected', value: overview.maintenance.rejected },
      ].filter((item) => item.value > 0)
    : [];

  const assetChart =
    overview?.assets.distribution
      .filter((item) => item.count > 0)
      .map((item) => ({ name: item.status.replace('_', ' '), value: item.count })) ?? [];

  const occupancyColumns: Column<BuildingOccupancy & { id: string }>[] = [
    { header: 'Building', cell: (row) => <span className="font-semibold text-white">{row.name}</span> },
    { header: 'Code', cell: (row) => <span className="font-mono text-xs text-slate-400">{row.code}</span> },
    { header: 'Rooms', accessorKey: 'total' },
    { header: 'Occupied', accessorKey: 'occupied' },
    { header: 'Available', accessorKey: 'available' },
    { header: 'Reserved', accessorKey: 'reserved' },
    { header: 'Maintenance', accessorKey: 'underMaintenance' },
    { header: 'Occupancy', cell: (row) => formatPercent(row.occupancyRate) },
  ];

  const performanceColumns: Column<BuildingPerformanceRow & { id: string }>[] = [
    { header: 'Building', cell: (row) => <span className="font-semibold text-white">{row.name}</span> },
    { header: 'Rooms', accessorKey: 'rooms' },
    { header: 'Occupancy', cell: (row) => formatPercent(row.occupancyRate) },
    {
      header: 'Electricity',
      cell: (row) => (row.electricity === null ? 'No data' : `${row.electricity.toLocaleString()} kWh`),
    },
    {
      header: 'Water',
      cell: (row) => (row.water === null ? 'No data' : `${row.water.toLocaleString()} L`),
    },
  ];

  const activityColumns: Column<RecentActivity>[] = [
    {
      header: 'When',
      cell: (row) => <span className="text-xs text-slate-400">{formatTimestamp(row.timestamp)}</span>,
    },
    { header: 'Module', accessorKey: 'module' },
    { header: 'Event', accessorKey: 'message' },
    {
      header: 'Severity',
      cell: (row) => (
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            row.severity === 'CRITICAL'
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : row.severity === 'WARNING'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          }`}
        >
          {row.severity}
        </span>
      ),
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Smart Campus Overview</h1>
          <p className="text-slate-400 text-sm mt-1">
            Live operations dashboard{user?.firstName ? ` for ${user.firstName}` : ''}.{' '}
            <Link to="/analytics" className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" />
              Campus Insights
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
            aria-label="From"
          />
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
            aria-label="To"
          />
          <select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
          >
            <option value="">All buildings</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => void refetch()}
            className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {isError && (
        <ErrorState
          title="Dashboard unavailable"
          message="The operations overview could not be loaded. Other campus modules remain available."
          onRetry={() => void refetch()}
        />
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      )}

      {overview && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard title="Buildings" value={overview.kpis.buildings} icon={Building2} variant="info" />
            <KpiCard title="Departments" value={overview.kpis.departments} icon={Layers} />
            <KpiCard
              title="Rooms"
              value={overview.kpis.rooms}
              subtitle={`${overview.kpis.classrooms} classrooms · ${overview.kpis.laboratories} labs`}
              icon={DoorOpen}
            />
            <KpiCard title="Assets" value={overview.kpis.assets} icon={Boxes} />
            <KpiCard
              title="Open Maintenance"
              value={overview.kpis.openMaintenance}
              subtitle={overview.maintenance.critical > 0 ? `${overview.maintenance.critical} critical` : 'No critical tickets'}
              icon={Wrench}
              variant={overview.kpis.openMaintenance > 0 ? 'warning' : 'success'}
            />
            <KpiCard title="Occupied Rooms" value={overview.kpis.occupiedRooms} icon={Users} variant="danger" />
            <KpiCard title="Available Rooms" value={overview.kpis.availableRooms} icon={School} variant="success" />
            <KpiCard
              title="Occupancy Rate"
              value={formatPercent(overview.kpis.occupancyRate)}
              subtitle={overview.occupancy.hasData ? `${overview.occupancy.occupied} of ${overview.occupancy.total} rooms` : 'No rooms available'}
              icon={FlaskConical}
            />
            <KpiCard
              title="Unread Alerts"
              value={unreadCount}
              subtitle="From notification center"
              icon={Bell}
              variant={unreadCount > 0 ? 'warning' : 'success'}
            />
            <KpiCard
              title="Parking Available"
              value={overview.kpis.parkingAvailable}
              subtitle={`${overview.kpis.parkingSlots} slots · ${formatPercent(overview.kpis.parkingUtilization)} utilized`}
              icon={Car}
              variant={overview.kpis.parkingAvailable > 0 ? 'success' : 'warning'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              {overview.occupancy.hasData && occupancyChart.length > 0 ? (
                <ChartContainer title="Occupancy Distribution" subtitle="Current room occupancy across the selected scope">
                  <PieChart>
                    <Pie data={occupancyChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                      {occupancyChart.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                    <Legend />
                  </PieChart>
                </ChartContainer>
              ) : (
                <EmptyState title="No rooms available" description="Occupancy analytics will appear after rooms are registered." />
              )}
            </div>
            <div className="lg:col-span-2">
              {overview.buildingOccupancy.length > 0 ? (
                <DataTable
                  columns={occupancyColumns}
                  data={overview.buildingOccupancy.map((row) => ({ ...row, id: row.buildingId }))}
                  emptyTitle="No building occupancy"
                  emptyDescription="No rooms match the current filters."
                />
              ) : (
                <EmptyState title="No building occupancy" description="Building-level occupancy requires rooms assigned to buildings." />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {overview.energy.electricity.available ? (
              <ChartContainer
                title="Electricity Trend"
                subtitle={`Daily ${formatNumber(overview.energy.electricity.daily, ' kWh')} · Weekly ${formatNumber(overview.energy.electricity.weekly, ' kWh')} · Monthly ${formatNumber(overview.energy.electricity.monthly, ' kWh')}`}
              >
                <AreaChart data={overview.energy.electricity.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="period" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="consumption" stroke="#10b981" fill="#10b98133" name="Electricity (kWh)" />
                </AreaChart>
              </ChartContainer>
            ) : (
              <EmptyState
                icon={Zap}
                title="No electricity data available"
                description="No meter readings were found for the selected window."
              />
            )}

            {overview.energy.water.available ? (
              <ChartContainer
                title="Water Trend"
                subtitle={`Daily ${formatNumber(overview.energy.water.daily, ' L')} · Weekly ${formatNumber(overview.energy.water.weekly, ' L')} · Monthly ${formatNumber(overview.energy.water.monthly, ' L')}`}
              >
                <AreaChart data={overview.energy.water.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="period" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="consumption" stroke="#06b6d4" fill="#06b6d433" name="Water (L)" />
                </AreaChart>
              </ChartContainer>
            ) : (
              <EmptyState
                icon={Droplet}
                title="No water readings available"
                description="No water meter readings were found for the selected window."
              />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {maintenanceChart.length > 0 ? (
              <ChartContainer
                title="Maintenance Status"
                subtitle={
                  overview.maintenance.averageResolutionHours !== null
                    ? `Average resolution ${overview.maintenance.averageResolutionHours} hours`
                    : 'No completed tickets for average resolution time'
                }
              >
                <BarChart data={maintenanceChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                  <Bar dataKey="value" fill="#f59e0b" name="Tickets" />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyState icon={Wrench} title="No maintenance requests" description="There are no maintenance tickets in the selected scope." />
            )}

            {assetChart.length > 0 ? (
              <ChartContainer title="Asset Health" subtitle={`${overview.assets.total} assets in the selected scope`}>
                <BarChart data={assetChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                  <Bar dataKey="value" fill="#10b981" name="Assets" />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyState icon={Boxes} title="No assets registered" description="Asset health will appear after assets are added." />
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Building2 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Building Performance</h2>
            </div>
            {overview.buildingPerformance.length > 0 ? (
              <DataTable
                columns={performanceColumns}
                data={overview.buildingPerformance.map((row) => ({ ...row, id: row.buildingId }))}
                emptyTitle="No building performance"
                emptyDescription="No buildings match the current filters."
              />
            ) : (
              <EmptyState title="No building performance" description="Performance appears after rooms are assigned to buildings." />
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Recent Campus Activity</h2>
            </div>
            {overview.recentActivity.length > 0 ? (
              <DataTable
                columns={activityColumns}
                data={overview.recentActivity}
                emptyTitle="No recent activity"
                emptyDescription="Audit events will appear here as campus operations occur."
              />
            ) : (
              <EmptyState title="No recent activity" description="No audit events are available. MongoDB may be offline or no actions have been logged yet." />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">AI Insights</h2>
              </div>
              <Link to="/digital-twin" className="text-xs font-semibold text-emerald-400 hover:underline">
                Open digital twin →
              </Link>
            </div>
            {twinQuery.data?.data ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-400">Campus health</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {twinQuery.data.data.health.overallScore}/100
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{twinQuery.data.data.health.healthLevel} risk</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-400">Top risks</p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-300">
                    {(twinQuery.data.data.health.topRisks.length > 0
                      ? twinQuery.data.data.health.topRisks
                      : ['No elevated risks']
                    )
                      .slice(0, 3)
                      .map((r) => (
                        <li key={r}>• {r}</li>
                      ))}
                  </ul>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-400">Recommended actions</p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-300">
                    {(twinQuery.data.data.health.recommendedActions.length > 0
                      ? twinQuery.data.data.health.recommendedActions
                      : ['Monitor campus operations']
                    )
                      .slice(0, 2)
                      .map((a) => (
                        <li key={a}>• {a}</li>
                      ))}
                  </ul>
                  <Link to="/ai-assistant" className="mt-3 inline-block text-xs text-indigo-400 hover:underline">
                    Ask AI for details →
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyState
                title="AI insights unavailable"
                description="Digital twin data requires digital_twin.view permission and backend connectivity."
              />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Alerts</h2>
              </div>
              <button
                onClick={() => navigate('/notifications')}
                className="text-xs font-semibold text-emerald-400 hover:underline"
              >
                Open notification center →
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <AlertList
                title="Critical maintenance"
                items={overview.alerts.criticalMaintenance.map((item) => ({
                  id: item.id,
                  title: item.title,
                  message: `${item.status} · ${item.roomNumber ?? 'Unassigned room'}`,
                }))}
                empty="No critical maintenance tickets."
              />
              <AlertList
                title="Energy anomalies"
                items={overview.alerts.energyAnomalies.map((item) => ({
                  id: item.id,
                  title: item.title,
                  message: item.message,
                }))}
                empty="No electricity anomalies logged."
              />
              <AlertList
                title="Water anomalies"
                items={overview.alerts.waterAnomalies.map((item) => ({
                  id: item.id,
                  title: item.title,
                  message: item.message,
                }))}
                empty="No water anomalies logged."
              />
            </div>
          </div>
        </>
      )}

      {isLoading && (
        <TableSkeleton rows={4} />
      )}
    </div>
  );
};

function AlertList({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ id: string; title: string; message: string }>;
  empty: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <h3 className="text-sm font-bold text-white mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="text-xs">
              <p className="font-semibold text-slate-200">{item.title}</p>
              <p className="text-slate-400 mt-0.5">{item.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
