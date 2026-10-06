import React from 'react';
import { ResponsiveContainer } from 'recharts';
import { Skeleton } from './Skeleton';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  height?: number | string;
  children: React.ReactElement;
  isLoading?: boolean;
  action?: React.ReactNode;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  height = 300,
  children,
  isLoading = false,
  action,
}) => {
  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-lg flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>

      {isLoading ? (
        <div className="w-full flex items-center justify-center" style={{ height }}>
          <Skeleton className="w-full h-full rounded-lg" />
        </div>
      ) : (
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
