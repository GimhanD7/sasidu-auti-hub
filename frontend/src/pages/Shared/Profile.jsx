import ChangePassword from './ChangePassword';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../auth/useAuth';
export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    mobile: user?.mobile || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const initials = (user?.fullName || 'Profile')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch('/auth/me', form);
      setForm({
        fullName: data.user.fullName || '',
        email: data.user.email || '',
        mobile: data.user.mobile || '',
      });
      updateUser(data.user);
      setNotice(data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update your profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="grid gap-6 text-zinc-100">
      <header className="relative isolate flex flex-wrap items-center gap-5 overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 via-zinc-950 to-red-950/60 p-6 shadow-xl sm:p-8">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-brand-red text-xl font-extrabold text-white shadow-lg shadow-red-950/40">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-red-400">
            Account profile
          </p>
          <h1 className="m-0 text-3xl font-extrabold tracking-tight text-white">Profile</h1>
          <p className="mb-0 mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Manage your personal details and account security. Your workshop role is managed by an
            administrator.
          </p>
        </div>
        <span className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300">
          {user?.role || 'User'}
        </span>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
        <section className="rounded-2xl border border-neutral-800 bg-zinc-950 p-5 shadow-lg sm:p-6">
          <div className="mb-5 border-b border-neutral-800 pb-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-red-400">
              Personal information
            </p>
            <h2 className="m-0 text-lg font-bold text-white">Profile details</h2>
          </div>
          {error && (
            <p
              className="mb-4 rounded-lg border border-red-500/30 bg-red-950/50 px-3 py-2 text-sm text-red-200"
              role="alert"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200"
              role="status"
            >
              {notice}
            </p>
          )}
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
            <label className="grid content-start gap-2 text-sm font-semibold text-zinc-300">
              Full name
              <input
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                value={form.fullName}
                className="min-h-11 rounded-lg border border-neutral-700 bg-zinc-900 px-3 text-sm text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                onChange={(event) =>
                  setForm((current) => ({ ...current, fullName: event.target.value }))
                }
              />
            </label>
            <label className="grid content-start gap-2 text-sm font-semibold text-zinc-300">
              Email address
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={form.email}
                className="min-h-11 rounded-lg border border-neutral-700 bg-zinc-900 px-3 text-sm text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>
            <label className="grid content-start gap-2 text-sm font-semibold text-zinc-300">
              Mobile number
              <input
                type="tel"
                autoComplete="tel"
                maxLength={20}
                value={form.mobile}
                className="min-h-11 rounded-lg border border-neutral-700 bg-zinc-900 px-3 text-sm text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                onChange={(event) =>
                  setForm((current) => ({ ...current, mobile: event.target.value }))
                }
              />
              <small className="text-xs font-normal text-zinc-500">
                Leave blank if you do not want a mobile number on your profile.
              </small>
            </label>
            <label className="grid content-start gap-2 text-sm font-semibold text-zinc-300">
              Role
              <input
                className="min-h-11 rounded-lg border border-neutral-800 bg-zinc-900/60 px-3 text-sm text-zinc-400"
                value={user?.role || ''}
                readOnly
              />
            </label>
            <footer className="flex justify-end border-t border-neutral-800 pt-4 sm:col-span-2">
              <button
                className="rounded-lg border border-red-600 bg-brand-red px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-red-hover disabled:cursor-wait disabled:opacity-60"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            </footer>
          </form>
        </section>
        <ChangePassword embedded />
      </div>
    </main>
  );
}
