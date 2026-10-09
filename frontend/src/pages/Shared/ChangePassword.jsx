// Submit the current and new passwords; a successful change requires signing in again with the new password.
import PasswordInput from '../../components/PasswordInput';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../auth/useAuth';
export default function ChangePassword({ embedded = false } = {}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { logout } = useAuth();

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setError('');
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError('New password must be no more than 72 UTF-8 bytes.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      // Send the submitted data to the server; the response below determines the success message and local state changes.
      const { data } = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      await logout();
      navigate('/login', { replace: true, state: { message: data.message } });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || 'Unable to change your password. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={embedded ? 'grid gap-4' : 'technician-security-page'}>
      {!embedded && (
        <header>
          <h1 className="page-title">Profile security</h1>
          <p className="page-subtitle">Change your account password.</p>
        </header>
      )}
      <section
        className={
          embedded
            ? 'rounded-2xl border border-neutral-800 bg-zinc-950 p-5 shadow-lg sm:p-6'
            : 'section-card technician-password-card'
        }
      >
        <div className="mb-5 border-b border-neutral-800 pb-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-red-400">
            Security
          </p>
          <h2 className="m-0 text-lg font-bold text-white">Change password</h2>
          <p className="mb-0 mt-2 text-sm leading-6 text-zinc-400">
            Use your current password to set a new one. You’ll be signed out after changing it.
          </p>
        </div>
        {error && (
          <p
            className="mb-4 rounded-lg border border-red-500/30 bg-red-950/50 px-3 py-2 text-sm text-red-200"
            role="alert"
          >
            {error}
          </p>
        )}
        <form className="grid gap-4" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-semibold text-zinc-300">
            Current password
            <PasswordInput
              autoComplete="current-password"
              className="min-h-11 w-full rounded-lg border border-neutral-700 bg-zinc-900 px-3 pr-12 text-sm text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-zinc-300">
            New password
            <PasswordInput
              autoComplete="new-password"
              className="min-h-11 w-full rounded-lg border border-neutral-700 bg-zinc-900 px-3 pr-12 text-sm text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              minLength={8}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <small className="text-xs font-normal text-zinc-500">At least 8 characters.</small>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-zinc-300">
            Confirm new password
            <PasswordInput
              autoComplete="new-password"
              className="min-h-11 w-full rounded-lg border border-neutral-700 bg-zinc-900 px-3 pr-12 text-sm text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              minLength={8}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <footer className="flex justify-end border-t border-neutral-800 pt-4">
            <button
              className="rounded-lg border border-red-600 bg-brand-red px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-red-hover disabled:cursor-wait disabled:opacity-60"
              type="submit"
              disabled={saving}
            >
              {saving ? 'Changing…' : 'Change password'}
            </button>
          </footer>
        </form>
      </section>
    </section>
  );
}
