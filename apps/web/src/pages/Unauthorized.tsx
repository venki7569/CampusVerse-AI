import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../store/authContext';

export const Unauthorized: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 text-slate-100">
      <div className="max-w-md w-full text-center space-y-6 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-10 h-10" />
        </div>

        <h1 className="text-3xl font-extrabold text-white">403 — Access Denied</h1>

        <p className="text-sm text-slate-400">
          You do not have the required permissions or assigned role to view this resource.
        </p>

        {user && (
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-left text-xs">
            <p className="text-slate-400">Your Assigned Roles:</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {user.roles.map((r) => (
                <span key={r} className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};
