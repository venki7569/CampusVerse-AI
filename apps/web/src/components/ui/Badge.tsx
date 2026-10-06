export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  danger: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  info: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
};

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ label, variant = 'neutral', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${variantClasses[variant]} ${className}`}
    >
      {label.replace(/_/g, ' ')}
    </span>
  );
}

const severityVariants: Record<string, BadgeVariant> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'warning',
  LOW: 'neutral',
  URGENT: 'danger',
  NORMAL: 'neutral',
};

const statusVariants: Record<string, BadgeVariant> = {
  ONLINE: 'success',
  OFFLINE: 'danger',
  STALE: 'warning',
  MAINTENANCE: 'info',
  ARCHIVED: 'neutral',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  REPORTED: 'info',
  ASSIGNED: 'info',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  OPEN: 'info',
  ACKNOWLEDGED: 'warning',
  DISMISSED: 'neutral',
  PUBLISHED: 'success',
  DRAFT: 'neutral',
  SCHEDULED: 'info',
  EXPIRED: 'neutral',
};

export function SeverityBadge({ severity }: { severity: string }) {
  return <Badge label={severity} variant={severityVariants[severity] ?? 'neutral'} />;
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge label={status} variant={statusVariants[status] ?? 'neutral'} />;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, BadgeVariant> = {
    CRITICAL: 'danger',
    HIGH: 'warning',
    MEDIUM: 'info',
    LOW: 'neutral',
  };
  return <Badge label={priority} variant={map[priority] ?? 'neutral'} />;
}
