import { useState } from 'react';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { CardSkeleton } from '../components/ui/Skeleton';
import {
  useRecommendations,
  useAcknowledgeRecommendation,
  useDismissRecommendation,
  useResolveRecommendation,
} from '../hooks/useRecommendations';

import { SeverityBadge, StatusBadge } from '../components/ui/Badge';

export function Recommendations() {
  const [status, setStatus] = useState('OPEN');
  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useRecommendations({
    page: 1,
    limit: 50,
    status: status || undefined,
    severity: severity || undefined,
    search: search || undefined,
  });

  const acknowledge = useAcknowledgeRecommendation();
  const dismiss = useDismissRecommendation();
  const resolve = useResolveRecommendation();

  const items = data?.data ?? [];

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb />
      <div>
        <h1 className="text-2xl font-bold text-white">Operational Recommendations</h1>
        <p className="text-sm text-slate-400">
          AI-generated insights require human review — no autonomous actions are taken.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="DISMISSED">Dismissed</option>
          <option value="RESOLVED">Resolved</option>
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
        >
          <option value="">All severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <input
          type="search"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
        />
      </div>

      {isLoading && <CardSkeleton />}
      {isError && <ErrorState title="Failed to load recommendations" onRetry={() => refetch()} />}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          title="No recommendations"
          description="Run sync from the Digital Twin page or wait for intelligence analysis."
        />
      )}

      <div className="space-y-4">
        {items.map((rec) => (
          <article key={rec.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={rec.severity} />
                  <StatusBadge status={rec.type} />
                  <StatusBadge status={rec.status} />
                </div>
                <h2 className="mt-2 text-lg font-semibold text-white">{rec.title}</h2>
                <p className="mt-1 text-sm text-slate-400">{rec.description}</p>
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-slate-950 border border-slate-800 p-3 text-sm">
              <p className="font-medium text-slate-200">Recommended action</p>
              <p className="text-slate-400">{rec.recommendedAction}</p>
              <p className="mt-2 text-xs text-slate-500">
                Entity: {rec.affectedEntity.type} — {rec.affectedEntity.label}
              </p>
              {(() => {
                const rule = rec.evidence['rule'];
                return rule ? (
                  <p className="mt-1 text-xs text-slate-500">Rule: {String(rule)}</p>
                ) : null;
              })()}
            </div>

            {rec.status === 'OPEN' && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => acknowledge.mutate(rec.id)}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  Acknowledge
                </button>
                <button
                  type="button"
                  onClick={() => resolve.mutate(rec.id)}
                  className="rounded-lg border border-emerald-500/30 px-3 py-1.5 text-sm text-emerald-400 hover:bg-emerald-500/10"
                >
                  Resolve
                </button>
                <button
                  type="button"
                  onClick={() => dismiss.mutate(rec.id)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Dismiss
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
