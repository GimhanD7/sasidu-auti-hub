import ChangePassword from './ChangePassword';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../auth/useAuth';
import './AccountSettings.css';

export default function AccountSettings() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ fullName: user?.fullName || '', email: user?.email || '', mobile: user?.mobile || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const { data } = await api.patch('/auth/me', form);
      setForm({ fullName: data.user.fullName || '', email: data.user.email || '', mobile: data.user.mobile || '' });
      updateUser(data.user);
      setNotice(data.message);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to update your profile.'); }
    finally { setSaving(false); }
  }

  return <main className="account-settings-page"><header><p>ACCOUNT · PROFILE</p><h1>Account settings</h1><span>Manage your contact details. Your access role is controlled by the workshop.</span></header><section className="account-settings-card section-card"><h2>Profile details</h2>{error && <p className="account-settings-message error" role="alert">{error}</p>}{notice && <p className="account-settings-message success" role="status">{notice}</p>}<form onSubmit={save}><label>Full name<input autoComplete="name" required minLength={2} maxLength={100} value={form.fullName} onChange={event => setForm(current => ({ ...current, fullName: event.target.value }))} /></label><label>Email address<input type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></label><label>Mobile number<input type="tel" autoComplete="tel" maxLength={20} value={form.mobile} onChange={event => setForm(current => ({ ...current, mobile: event.target.value }))} /><small>Leave blank if you do not want a mobile number on your profile.</small></label><label>Role<input value={user?.role || ''} readOnly /></label><footer><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button></footer></form></section><ChangePassword /></main>;
}
