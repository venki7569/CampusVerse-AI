import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Activity,
  AlertTriangle,
  Zap,
  Droplet,
  Wrench,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { KpiCard } from '../components/ui/KpiCard';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { CardSkeleton } from '../components/ui/Skeleton';
import { SeverityBadge } from '../components/ui/Badge';
import { useDigitalTwinOverview, useSyncRecommendations } from '../hooks/useDigitalTwin';

export function DigitalTwin() {
  const { data, isLoading, isError, refetch, isFetching } = useDigitalTwinOverview();
  const syncMutation = useSyncRecommendations();
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);

  const overview = data?.data;

  if (isLoading) {
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

  if (isError || !overview) {
    return <ErrorState title="Digital twin unavailable" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Campus Digital Twin</h1>
          <p className="text-sm text-slate-400">
            Live operational model — last updated {new Date(overview.lastUpdated).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync recommendations
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Campus Health" value={`${overview.health.overallScore}/100`} icon={Activity} />
        <KpiCard title="Buildings" value={overview.summary.buildings} icon={Building2} />
        <KpiCard title="Open Maintenance" value={overview.summary.openMaintenance} icon={Wrench} />
        <KpiCard title="Open Recommendations" value={overview.summary.openRecommendations} icon={AlertTriangle} />
      </div>

      {overview.iot && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
            <Activity className="h-5 w-5 text-emerald-400" />
            Live IoT Indicators
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm">
              <span className="text-slate-400">Devices</span>
              <p className="text-xl font-bold text-white">{overview.iot.totalDevices}</p>
            </div>
            <div className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm">
              <span className="text-emerald-400">Online</span>
              <p className="text-xl font-bold text-white">{overview.iot.online}</p>
            </div>
            <div className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm">
              <span className="text-rose-400">Offline</span>
              <p className="text-xl font-bold text-white">{overview.iot.offline}</p>
            </div>
            <div className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm">
              <span className="text-amber-400">Stale</span>
              <p className="text-xl font-bold text-white">{overview.iot.stale}</p>
            </div>
            <div className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm">
              <span className="text-slate-400">Active alerts</span>
              <p className="text-xl font-bold text-white">{overview.iot.activeAlerts}</p>
            </div>
          </div>
          <Link to="/iot" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-emerald-400">
            Open IoT Control Center <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-3 text-lg font-semibold text-white">Campus Health</h2>
          <p className="mb-4 text-sm text-slate-400">{overview.health.formula}</p>
          <div className="space-y-2">
            {overview.health.dimensions.map((d) => (
              <div key={d.key} className="flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-200">
                <span>{d.label}</span>
                <span className="font-semibold">{d.score}</span>
              </div>
            ))}
          </div>
          {overview.health.topRisks.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-700">Top risks</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-400">
                {overview.health.topRisks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-3 text-lg font-semibold text-white">Occupancy Intelligence</h2>
          <p className="text-sm text-slate-400">{overview.occupancy.explanation}</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {overview.occupancy.utilizationRate ?? '—'}%
          </p>
          <p className="text-xs text-slate-500">
            {overview.occupancy.occupied} / {overview.occupancy.total} rooms in use
          </p>
        </section>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Buildings</h2>
          <Link to="/recommendations" className="text-sm font-medium text-emerald-400 hover:text-emerald-300">
            View recommendations
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {overview.buildings.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedBuilding(selectedBuilding === b.id ? null : b.id)}
              className={`rounded-lg border p-4 text-left transition hover:border-emerald-500/40 ${
                selectedBuilding === b.id ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-white">{b.name}</p>
                  <p className="text-xs text-slate-500">{b.code}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
              <div className="mt-3 flex gap-4 text-xs text-slate-400">
                <span>{b.floorCount} floors</span>
                <span>{b.roomCount} rooms</span>
                <span>{b.occupancyRate ?? '—'}% occ.</span>
              </div>
            </button>
          ))}
        </div>
        {overview.buildings.length === 0 && (
          <EmptyState title="No buildings" description="Add buildings to populate the digital twin." />
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
            <Wrench className="h-5 w-5" /> Maintenance Risk
          </h2>
          {overview.maintenanceRisks.topRisks.length === 0 ? (
            <p className="text-sm text-slate-500">No elevated maintenance risks detected.</p>
          ) : (
            <ul className="space-y-3">
              {overview.maintenanceRisks.topRisks.slice(0, 5).map((r) => (
                <li key={r.assetId} className="rounded-lg border border-slate-800 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">{r.assetTag}</span>
                    <SeverityBadge severity={r.riskLevel} />
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{r.explanation}</p>
                  <p className="mt-1 text-xs text-emerald-400">{r.recommendedAction}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
            <Zap className="h-5 w-5" /> Utility Anomalies
          </h2>
          {overview.utilityAnomalies.anomalies.length === 0 ? (
            <p className="text-sm text-slate-500">No utility anomalies detected in current window.</p>
          ) : (
            <ul className="space-y-3">
              {overview.utilityAnomalies.anomalies.map((a, i) => (
                <li key={`${a.metric}-${a.entityLabel}-${i}`} className="rounded-lg border border-slate-800 p-3">
                  <div className="flex items-center gap-2">
                    {a.metric === 'water' ? <Droplet className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                    <span className="font-medium text-white">{a.entityLabel}</span>
                    <SeverityBadge severity={a.severity} />
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{a.explanation}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
