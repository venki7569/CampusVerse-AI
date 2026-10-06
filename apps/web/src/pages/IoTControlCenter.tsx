import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  Wifi,
  WifiOff,
  AlertTriangle,
  Activity,
  Filter,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { KpiCard } from '../components/ui/KpiCard';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { CardSkeleton } from '../components/ui/Skeleton';
import {
  useIoTSummary,
  useIoTDevices,
  useDeviceHealth,
  useOperationalActions,
  useApproveAction,
  useRejectAction,
} from '../hooks/useIoT';
import { StatusBadge } from '../components/ui/Badge';

export function IoTControlCenter() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const summaryQuery = useIoTSummary();
  const devicesQuery = useIoTDevices({
    page: 1,
    limit: 50,
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  });
  const healthQuery = useDeviceHealth(selectedId ?? '');
  const actionsQuery = useOperationalActions('PROPOSED');
  const approveMutation = useApproveAction();
  const rejectMutation = useRejectAction();

  const summary = summaryQuery.data;
  const devices = devicesQuery.data?.data ?? [];
  const actions = actionsQuery.data?.data ?? [];

  if (summaryQuery.isLoading) {
    return (
      <div className="space-y-6 p-6">
        <CardSkeleton />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (summaryQuery.isError) {
    return <ErrorState title="IoT Control Center unavailable" onRetry={() => summaryQuery.refetch()} />;
  }

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">IoT Control Center</h1>
          <p className="text-sm text-slate-400">Device registry, telemetry activity, and operational actions</p>
        </div>
        <Link
          to="/digital-twin"
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-400 hover:text-emerald-300"
        >
          Live Digital Twin <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Total Devices" value={summary?.totalDevices ?? 0} icon={Cpu} />
        <KpiCard title="Online" value={summary?.online ?? 0} icon={Wifi} />
        <KpiCard title="Offline" value={summary?.offline ?? 0} icon={WifiOff} />
        <KpiCard title="Stale" value={summary?.stale ?? 0} icon={Activity} />
        <KpiCard title="Maintenance" value={summary?.maintenance ?? 0} icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Devices</h2>
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-white"
            >
              <option value="">All types</option>
              <option value="ELECTRICITY_METER">Electricity</option>
              <option value="WATER_METER">Water</option>
              <option value="OCCUPANCY_SENSOR">Occupancy</option>
              <option value="TEMPERATURE_SENSOR">Temperature</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-white"
            >
              <option value="">All statuses</option>
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
              <option value="STALE">Stale</option>
            </select>
          </div>

          {devicesQuery.isLoading ? (
            <CardSkeleton />
          ) : devices.length === 0 ? (
            <EmptyState title="No devices registered" description="Register IoT devices via the API or admin tools." />
          ) : (
            <div className="divide-y divide-slate-800">
              {devices.map((device) => (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => setSelectedId(device.id)}
                  className={`flex w-full items-center justify-between px-2 py-3 text-left hover:bg-slate-800/50 ${
                    selectedId === device.id ? 'bg-emerald-500/5' : ''
                  }`}
                >
                  <div>
                    <p className="font-medium text-white">{device.name}</p>
                    <p className="text-xs text-slate-500">
                      {device.deviceId} · {device.type.replace(/_/g, ' ')}
                      {device.room ? ` · Room ${device.room.roomNumber}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={device.status} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-3 text-lg font-semibold text-white">Device Details</h2>
          {!selectedId ? (
            <p className="text-sm text-slate-500">Select a device to view health and telemetry status.</p>
          ) : healthQuery.isLoading ? (
            <CardSkeleton />
          ) : healthQuery.data ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Health score</span>
                <span className="font-semibold">{healthQuery.data.healthScore}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Data freshness</span>
                <span className="font-medium">{healthQuery.data.dataFreshness}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last seen</span>
                <span className="font-medium">
                  {healthQuery.data.lastSeenAt
                    ? new Date(healthQuery.data.lastSeenAt).toLocaleString()
                    : 'Never'}
                </span>
              </div>
              {healthQuery.data.issues.length > 0 && (
                <ul className="mt-2 space-y-1 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-amber-300">
                  {healthQuery.data.issues.map((issue) => (
                    <li key={issue.code}>{issue.message}</li>
                  ))}
                </ul>
              )}
              {healthQuery.data.recommendedAction && (
                <p className="text-slate-600">{healthQuery.data.recommendedAction}</p>
              )}
            </div>
          ) : (
            <ErrorState title="Health data unavailable" onRetry={() => healthQuery.refetch()} />
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-4 text-lg font-semibold text-white">Pending Action Approvals</h2>
        <p className="mb-4 text-sm text-slate-500">
          AI and rules may propose actions — explicit approval is required before execution.
        </p>
        {actions.length === 0 ? (
          <EmptyState title="No pending actions" description="Proposed operational actions will appear here." />
        ) : (
          <div className="space-y-4">
            {actions.map((action) => (
              <article key={action._id} className="rounded-lg border border-slate-800 p-4">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-white">{action.title}</h3>
                    <p className="text-sm text-slate-400">{action.description}</p>
                  </div>
                  <StatusBadge status={action.status} />
                </div>
                <p className="mb-2 text-xs text-slate-500">Source: {action.source} · {action.reason}</p>
                {action.evidence && Object.keys(action.evidence).length > 0 && (
                  <pre className="mb-3 overflow-x-auto rounded bg-slate-950 border border-slate-800 p-2 text-xs text-slate-400">
                    {JSON.stringify(action.evidence, null, 2)}
                  </pre>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => approveMutation.mutate(action._id)}
                    disabled={approveMutation.isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectMutation.mutate({ id: action._id })}
                    disabled={rejectMutation.isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" /> Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
