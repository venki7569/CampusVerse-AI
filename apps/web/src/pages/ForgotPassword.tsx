import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { KeyRound, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
      if (res.data.data.resetToken) {
        setResetToken(res.data.data.resetToken);
      }
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-4">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-3xl font-extrabold text-white">Reset Password</h2>
        <p className="mt-2 text-sm text-slate-400">Enter your email to receive password reset instructions</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 py-8 px-4 border border-slate-800 sm:rounded-xl sm:px-10">
          {submitted ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <p className="text-sm text-slate-300">
                If an account exists for <span className="font-semibold text-white">{email}</span>, password reset instructions have been dispatched.
              </p>
              {resetToken && (
                <div className="p-3 bg-slate-950 rounded border border-slate-800 text-left text-xs space-y-1">
                  <p className="font-semibold text-emerald-400">Dev Mode — Simulated Reset Token:</p>
                  <p className="font-mono text-slate-300 break-all">{resetToken}</p>
                  <Link
                    to={`/reset-password?token=${resetToken}`}
                    className="inline-block mt-2 text-emerald-400 underline font-medium"
                  >
                    Click to Reset Password →
                  </Link>
                </div>
              )}
              <Link to="/login" className="inline-flex items-center text-sm font-medium text-emerald-400 hover:underline pt-2">
                <ArrowLeft className="w-4 h-4 mr-2" /> Return to Login
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-slate-300">Email address</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending Instructions...' : 'Send Reset Link'}
              </button>

              <div className="text-center pt-2">
                <Link to="/login" className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-white">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
