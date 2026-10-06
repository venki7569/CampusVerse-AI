import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Boxes,
  Wrench,
  Zap,
  Droplet,
  Car,
  DoorOpen,
  AlertTriangle,
  RefreshCw,
  Download,
} from 'lucide-react';
import {
  useAnalyticsOverview,
  useAnalyticsTrends,
  useBuildingAnalytics,
  useDepartmentAnalytics,
  useUtilityAnalytics,
  useMaintenanceAnalytics,
  useAssetAnalytics,
  useOccupancyAnalytics,
  useParkingAnalytics,
  downloadAnalyticsExport,
} from '../hooks/useAnalytics';
import { useBuildings } from '../hooks/useBuildings';
import { useToast } from '../components/ui/Toast';
import { KpiCard } from '../components/ui/KpiCard';
import { DataTable, type Column } from '../components/ui/DataTable';
import { ChartContainer } from '../components/ui/ChartContainer';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import type {
  AnalyticsDatePreset,
  AnalyticsQueryParams,
  BuildingAnalytics,
  DepartmentAnalytics,
} from '../types';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const PRESETS: { label: string; value: AnalyticsDatePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: '7 days', value: 'last7days' },
  { label: '30 days', value: 'last30days' },
  { label: '90 days', value: 'last90days' },
  { label: 'This month', value: 'currentMonth' },
];

const CHART_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa'];

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value}%`;
}

export function Analytics() {
  const toast = useToast();
  const [preset, setPreset] = useState<AnalyticsDatePreset>('last30days');
  const [buildingId, setBuildingId] = useState('');
  const [exporting, setExporting] = useState(false);

  const params = useMemo<AnalyticsQueryParams>(
    () => ({
      preset,
      buildingId: buildingId || undefined,
      granularity: 'daily',
      page: 1,
      limit: 20,
      sortBy: 'occupancyRate',
      sortOrder: 'desc',
    }),
    [preset, buildingId],
  );

  const overviewQuery = useAnalyticsOverview(params);
  const trendsQuery = useAnalyticsTrends(params);
  const buildingsQuery = useBuildingAnalytics(params);
  const departmentsQuery = useDepartmentAnalytics(params);
  const utilitiesQuery = useUtilityAnalytics(params);
  const maintenanceQuery = useMaintenanceAnalytics(params);
  const assetsQuery = useAssetAnalytics(params);
  const occupancyQuery = useOccupancyAnalytics(params);
  const parkingQuery = useParkingAnalytics(params);
  const { data: buildingsData } = useBuildings({ page: 1, limit: 100, sortBy: 'name' });

  const overview = overviewQuery.data?.data;
  const trends = trendsQuery.data?.data;
  const buildings = buildingsQuery.data?.data ?? [];
  const departments = departmentsQuery.data?.data ?? [];
  const utilities = utilitiesQuery.data?.data;
  const maintenance = maintenanceQuery.data?.data;
  const assets = assetsQuery.data?.data;
  const occupancy = occupancyQuery.data?.data;
  const parking = parkingQuery.data?.data;

  const isLoading = overviewQuery.isLoading;
  const isError = overviewQuery.isError;
  const refetchAll = () => {
    void overviewQuery.refetch();
    void trendsQuery.refetch();
    void buildingsQuery.refetch();
    void departmentsQuery.refetch();
    void utilitiesQuery.refetch();
    void maintenanceQuery.refetch();
    void assetsQuery.refetch();
    void occupancyQuery.refetch();
    void parkingQuery.refetch();
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      await downloadAnalyticsExport({
        ...params,
        category: 'campus_overview',
        format,
      });
      toast.success(`Analytics exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed — check analytics.report permission');
    } finally {
      setExporting(false);
    }
  };

  const buildingRows = useMemo(
    () => buildings.map((b) => ({ ...b, id: b.buildingId })),
    [buildings],
  );
  const departmentRows = useMemo(
    () => departments.map((d) => ({ ...d, id: d.departmentId })),
    [departments],
  );

  const buildingColumns: Column<(BuildingAnalytics & { id: string })>[] = [
    { header: 'Building', cell: (row) => `${row.code} — ${row.name}` },
    { header: 'Rooms', cell: (row) => row.rooms },
    { header: 'Occupancy', cell: (row) => formatPercent(row.occupancyRate) },
    { header: 'Assets', cell: (row) => row.assets },
    { header: 'Maintenance', cell: (row) => row.maintenanceIssues },
    {
      header: 'Electricity (kWh)',
      cell: (row) => (row.electricityKwh === null ? '—' : row.electricityKwh.toLocaleString()),
    },
    {
      header: 'Water (L)',
      cell: (row) => (row.waterLiters === null ? '—' : row.waterLiters.toLocaleString()),
    },
    { header: 'Parking util.', cell: (row) => formatPercent(row.parkingUtilization) },
  ];

  const departmentColumns: Column<(DepartmentAnalytics & { id: string })>[] = [
    { header: 'Department', cell: (row) => `${row.code} — ${row.name}` },
    { header: 'Rooms', cell: (row) => row.rooms },
    { header: 'Assets', cell: (row) => row.assets },
    { header: 'Maintenance', cell: (row) => row.maintenanceIssues },
    { header: 'Open issues', cell: (row) => row.openMaintenance },
    { header: 'Elec. meters', cell: (row) => row.electricityMeters },
    {
      header: 'Electricity (kWh)',
      cell: (row) => (row.electricityKwh === null ? '—' : row.electricityKwh.toLocaleString()),
    },
  ];

  const maintenanceChart = useMemo(() => {
    if (!maintenance) return [];
    return maintenance.byPriority.map((p) => ({ name: p.priority, count: p.count }));
  }, [maintenance]);

  const assetChart = useMemo(() => {
    if (!assets) return [];
    return assets.byCategory.map((c) => ({ name: c.name, count: c.count }));
  }, [assets]);

  if (isError) {
    return <ErrorState title="Analytics unavailable" onRetry={refetchAll} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <Breadcrumb />
          <h1 className="text-2xl font-bold text-white mt-2 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-sky-400" />
            Campus Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Cross-module operational intelligence from live campus data — facilities, utilities,
            maintenance, assets, occupancy, and parking.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                preset === p.value
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
          <select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
          >
            <option value="">All buildings</option>
            {(buildingsData?.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => void handleExport('csv')}
            disabled={exporting}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-1 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={() => void handleExport('json')}
            disabled={exporting}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-1 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            JSON
          </button>
          <button
            onClick={refetchAll}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${overviewQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <KpiCard title="Buildings" value={overview?.kpis.buildings ?? 0} icon={Building2} isLoading={isLoading} />
        <KpiCard title="Rooms" value={overview?.kpis.rooms ?? 0} icon={DoorOpen} isLoading={isLoading} />
        <KpiCard
          title="Occupancy"
          value={formatPercent(overview?.kpis.occupancyRate)}
          icon={DoorOpen}
          isLoading={isLoading}
        />
        <KpiCard title="Assets" value={overview?.kpis.assets ?? 0} icon={Boxes} isLoading={isLoading} />
        <KpiCard
          title="Maintenance"
          value={overview?.kpis.openMaintenance ?? 0}
          subtitle={`${overview?.kpis.resolvedMaintenance ?? 0} resolved`}
          icon={Wrench}
          variant="warning"
          isLoading={isLoading}
        />
        <KpiCard
          title="Electricity"
          value={
            overview?.kpis.electricityConsumptionKwh === null ||
            overview?.kpis.electricityConsumptionKwh === undefined
              ? '—'
              : `${overview.kpis.electricityConsumptionKwh.toLocaleString()} kWh`
          }
          icon={Zap}
          isLoading={isLoading}
        />
        <KpiCard
          title="Water"
          value={
            overview?.kpis.waterConsumptionLiters === null ||
            overview?.kpis.waterConsumptionLiters === undefined
              ? '—'
              : `${overview.kpis.waterConsumptionLiters.toLocaleString()} L`
          }
          icon={Droplet}
          isLoading={isLoading}
        />
        <KpiCard
          title="Parking"
          value={formatPercent(overview?.kpis.parkingUtilization)}
          subtitle={`${overview?.kpis.parkingAvailable ?? 0} available`}
          icon={Car}
          isLoading={isLoading}
        />
      </div>

      {(utilities?.electricity.anomalyCount ?? 0) + (utilities?.water.anomalyCount ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-200">Utility anomalies detected</p>
            <p className="text-xs text-amber-100/80 mt-1">
              {utilities?.electricity.anomalyCount ?? 0} electricity · {utilities?.water.anomalyCount ?? 0}{' '}
              water anomalies in the selected period. See{' '}
              <Link to="/notifications" className="underline">
                notifications
              </Link>{' '}
              for details.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Electricity trend" subtitle="Daily consumption (kWh)">
          {trendsQuery.isLoading ? (
            <EmptyState title="Loading..." description="" />
          ) : (trends?.electricity.daily.length ?? 0) === 0 ? (
            <EmptyState title="No electricity data" description="No readings in the selected period." />
          ) : (
            <AreaChart data={trends?.electricity.daily ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Area type="monotone" dataKey="value" stroke="#34d399" fill="#34d39933" name="kWh" />
            </AreaChart>
          )}
        </ChartContainer>

        <ChartContainer title="Water trend" subtitle="Daily consumption (liters)">
          {trendsQuery.isLoading ? (
            <EmptyState title="Loading..." description="" />
          ) : (trends?.water.daily.length ?? 0) === 0 ? (
            <EmptyState title="No water data" description="No readings in the selected period." />
          ) : (
            <AreaChart data={trends?.water.daily ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Area type="monotone" dataKey="value" stroke="#60a5fa" fill="#60a5fa33" name="Liters" />
            </AreaChart>
          )}
        </ChartContainer>

        <ChartContainer title="Maintenance trend" subtitle="Issues created by day">
          {(trends?.maintenance.length ?? 0) === 0 ? (
            <EmptyState title="No maintenance trend data" description="No issues in the selected period." />
          ) : (
            <BarChart data={trends?.maintenance ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Legend />
              <Bar dataKey="reported" stackId="a" fill="#fbbf24" name="Reported" />
              <Bar dataKey="resolved" stackId="a" fill="#34d399" name="Resolved" />
              <Bar dataKey="closed" stackId="a" fill="#60a5fa" name="Closed" />
            </BarChart>
          )}
        </ChartContainer>

        <ChartContainer title="Parking utilization" subtitle="Allocation events by day">
          {(trends?.parking.length ?? 0) === 0 ? (
            <EmptyState
              title="No parking trend data"
              description="Allocation audit events will appear when slots are allocated or released."
            />
          ) : (
            <BarChart data={trends?.parking ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Bar dataKey="allocated" fill="#a78bfa" name="Allocated" />
            </BarChart>
          )}
        </ChartContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Maintenance by priority" subtitle="Selected period">
          {maintenanceChart.length === 0 ? (
            <EmptyState title="No data" description="" />
          ) : (
            <PieChart>
              <Pie data={maintenanceChart} dataKey="count" nameKey="name" innerRadius={50} outerRadius={80}>
                {maintenanceChart.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Legend />
            </PieChart>
          )}
        </ChartContainer>

        <ChartContainer title="Assets by category" subtitle="Current inventory">
          {assetChart.length === 0 ? (
            <EmptyState title="No assets" description="" />
          ) : (
            <PieChart>
              <Pie data={assetChart} dataKey="count" nameKey="name" innerRadius={50} outerRadius={80}>
                {assetChart.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Legend />
            </PieChart>
          )}
        </ChartContainer>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Building performance</h2>
        <DataTable
          columns={buildingColumns}
          data={buildingRows}
          isLoading={buildingsQuery.isLoading}
          emptyTitle="No building data"
          emptyDescription="Buildings will appear when campus facilities exist."
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Department performance</h2>
        <DataTable
          columns={departmentColumns}
          data={departmentRows}
          isLoading={departmentsQuery.isLoading}
          emptyTitle="No department data"
          emptyDescription="Departments will appear when configured."
        />
      </div>

      {occupancy && (
        <div className="text-xs text-slate-500 border-t border-slate-800 pt-4">
          Occupancy snapshot: {occupancy.occupied} occupied / {occupancy.total} rooms (
          {formatPercent(occupancy.occupancyRate)}) · Parking: {parking?.allocated ?? 0} allocated /{' '}
          {parking?.totalSlots ?? 0} slots · Unread alerts: {overview?.kpis.unreadAlerts ?? 0}
        </div>
      )}
    </div>
  );
}
