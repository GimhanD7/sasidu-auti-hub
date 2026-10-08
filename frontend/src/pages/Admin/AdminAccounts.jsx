import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../auth/useAuth';
import './AdminAccounts.css';

const emptyForm = { name: '', email: '', mobile: '', password: '', confirmPassword: '' };

export default function AdminAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [resetTarget, setResetTarget] = useState('');
  const [resetForm, setResetForm] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAccounts = useCallback(async query => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/accounts', { params: { search: query } });
      setAccounts(data.accounts || []);
      setError('');
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load accounts.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAccounts(''); }, [loadAccounts]);

  async function createAdmin(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const { data } = await api.post('/admin/accounts', form);
      setForm(emptyForm); setNotice(`Admin account created for ${data.account.name}.`);
      await loadAccounts(search);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to create this admin account.'); }
    finally { setSaving(false); }
  }

  async function resetPassword(event, account) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const { data } = await api.patch(`/admin/accounts/${account.id}/password`, resetForm);
      setNotice(data.message); setResetTarget(''); setResetForm({ password: '', confirmPassword: '' });
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to change this account password.'); }
    finally { setSaving(false); }
  }

  async function searchAccounts(event) {
    event.preventDefault(); setNotice(''); await loadAccounts(search);
  }

  return <div className="admin-accounts-page">
    <header className="admin-accounts-heading"><div><h1 className="page-title">Account Management</h1><p className="page-subtitle">Create admin accounts and reset passwords for other accounts.</p></div></header>
    {notice && <p className="admin-accounts-notice" role="status">{notice}</p>}
    {error && <p className="admin-accounts-error" role="alert">{error}</p>}

    <section className="section-card admin-account-create"><header><h2>Add admin account</h2><p>New admins can access the full admin panel.</p></header>
      <form onSubmit={createAdmin}>
        <label>Full name<input required minLength="2" maxLength="100" autoComplete="name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
        <label>Email<input required type="email" maxLength="254" autoComplete="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
        <label>Mobile (optional)<input type="tel" autoComplete="tel" value={form.mobile} onChange={event => setForm({ ...form, mobile: event.target.value })} /></label>
        <label>Password<input required type="password" minLength="8" autoComplete="new-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label>
        <label>Confirm password<input required type="password" minLength="8" autoComplete="new-password" value={form.confirmPassword} onChange={event => setForm({ ...form, confirmPassword: event.target.value })} /></label>
        <footer><button className="admin-accounts-primary" disabled={saving}>{saving ? 'Saving…' : 'Create admin account'}</button></footer>
      </form>
    </section>

    <section className="section-card admin-account-list"><header><div><h2>Accounts</h2><p>Choose an account to set a new password. That user will need to sign in again.</p></div></header>
      <form className="admin-account-search" onSubmit={searchAccounts}><label htmlFor="account-search">Search accounts</label><input id="account-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email, mobile, or role" /><button className="admin-accounts-secondary" disabled={loading}>Search</button></form>
      {loading ? <p role="status">Loading accounts…</p> : accounts.length ? <div className="admin-account-rows">{accounts.map(account => <article key={account.id} className="admin-account-row"><div className="admin-account-identity"><strong>{account.name}</strong><span>{account.email}{account.mobile ? ` · ${account.mobile}` : ''}</span></div><span className="admin-account-role">{account.role}{!account.isActive ? ' · Inactive' : ''}</span>
        {resetTarget === account.id ? <form className="admin-account-reset" onSubmit={event => resetPassword(event, account)}><label>New password<input required type="password" minLength="8" autoComplete="new-password" value={resetForm.password} onChange={event => setResetForm({ ...resetForm, password: event.target.value })} /></label><label>Confirm password<input required type="password" minLength="8" autoComplete="new-password" value={resetForm.confirmPassword} onChange={event => setResetForm({ ...resetForm, confirmPassword: event.target.value })} /></label><button className="admin-accounts-primary" disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button><button type="button" className="admin-accounts-secondary" onClick={() => setResetTarget('')} disabled={saving}>Cancel</button></form> : String(user?._id) === account.id ? <span className="admin-account-role">Your account · use Account settings</span> : <button type="button" className="admin-accounts-secondary" onClick={() => { setError(''); setResetTarget(account.id); setResetForm({ password: '', confirmPassword: '' }); }}>Change password</button>}
      </article>)}</div> : <p className="admin-accounts-empty">No accounts found.</p>}
      {!loading && accounts.length === 200 && <p className="admin-accounts-limit">Showing the first 200 matches. Refine your search to find another account.</p>}
    </section>
  </div>;
}
