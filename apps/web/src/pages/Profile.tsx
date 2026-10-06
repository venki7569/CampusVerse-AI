import React, { useState } from 'react';
import { useAuth } from '../store/authContext';
import { useToast } from '../components/ui/Toast';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { api } from '../services/api';
import { User, Lock, Save } from 'lucide-react';

export function Profile() {
  const { user, accessToken, refreshUser } = useAuth();
  const toast = useToast();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  React.useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
    }
  }, [user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch('/auth/me', { firstName, lastName });
      await refreshUser();
      toast.success('Profile updated', 'Your name has been saved.');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
              ?.message
          : undefined;
      toast.error('Update failed', message ?? 'Could not save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Password mismatch', 'New password and confirmation must match.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    setSavingPassword(true);
    try {
      await api.patch('/auth/me/password', { currentPassword, newPassword });
      toast.success('Password changed', 'You will need to sign in again on other devices.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
              ?.message
          : undefined;
      toast.error('Password change failed', message ?? 'Could not update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8 p-6 max-w-3xl">
      <Breadcrumb />
      <div>
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your account details and password.</p>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Personal information</h2>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
        <form onSubmit={(e) => void handleProfileSave(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-xs font-medium text-slate-400 mb-1">
                First name
              </label>
              <input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-xs font-medium text-slate-400 mb-1">
                Last name
              </label>
              <input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <span
                key={role}
                className="text-[10px] uppercase tracking-wider bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold"
              >
                {role.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {savingProfile ? 'Saving...' : 'Save profile'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Change password</h2>
            <p className="text-xs text-slate-500">Revokes refresh tokens on other sessions.</p>
          </div>
        </div>
        <form onSubmit={(e) => void handlePasswordChange(e)} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-xs font-medium text-slate-400 mb-1">
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
              autoComplete="current-password"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="newPassword" className="block text-xs font-medium text-slate-400 mb-1">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-400 mb-1">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={savingPassword || !accessToken}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {savingPassword ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </section>
    </div>
  );
}
