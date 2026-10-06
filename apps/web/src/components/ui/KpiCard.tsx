import React from 'react';
import { CardSkeleton } from './Skeleton';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: {
    value: number; // percentage e.g. 12.5 or -5.2
    label: string; // e.g. "vs last month"
  };
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  isLoading?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  isLoading = false,
}) => {
  if (isLoading) return <CardSkeleton />;

  const variantStyles = {
    default: 'border-slate-800 text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    success: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
    warning: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
    danger: 'border-rose-500/30 text-rose-400 bg-rose-500/10',
    info: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10',
  };

  const isPositive = trend && trend.value > 0;
  const isNegative = trend && trend.value < 0;

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        <div className={`p-2.5 rounded-lg border ${variantStyles[variant]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <p className="text-3xl font-extrabold text-white tracking-tight">{value}</p>
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 flex items-center justify-between text-xs pt-3 border-t border-slate-800/80">
          {subtitle && <span className="text-slate-400">{subtitle}</span>}

          {trend && (
            <div
              className={`flex items-center font-semibold space-x-1 ${
                isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              {isPositive && <TrendingUp className="w-3.5 h-3.5" />}
              {isNegative && <TrendingDown className="w-3.5 h-3.5" />}
              {!isPositive && !isNegative && <Minus className="w-3.5 h-3.5" />}
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-slate-500 font-normal">{trend.label}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
