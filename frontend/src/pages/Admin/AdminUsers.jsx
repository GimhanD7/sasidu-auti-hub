import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../auth/useAuth';
import './AdminUsers.css';

const roles = ['Customer', 'Technician', 'Finance', 'Admin'];
const emptyAdminForm = { name: '', email: '', mobile: '', password: '', confirmPassword: '' };

export default function AdminUsers() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [adminForm, setAdminForm] = useState(emptyAdminForm);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      api.get('/admin/users', { params: { search, page }, signal: controller.signal })
        .then(({ data }) => { setAccounts(data.users); setPages(data.pages); setError(''); })
        .catch(error => { if (!controller.signal.aborted) setError(error.response?.data?.message || 'Unable to load accounts.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, search ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, page, retry]);

  function saved(account, message) {
    setAccounts(current => current.map(item => item.id === account.id ? account : item));
    setNotice(message);
  }

  async function createAdmin(event) {
    event.preventDefault(); setCreating(true); setError(''); setNotice('');
    try {
      const { data } = await api.post('/admin/accounts', adminForm);
      setAdminForm(emptyAdminForm); setPage(1); setNotice(`Admin account created for ${data.account.name}.`); setRetry(value => value + 1);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to create the admin account.'); }
    finally { setCreating(false); }
  }

  return <div className="admin-users-page">
    <header><h1 className="page-title">Accounts &amp; Roles</h1><p className="page-subtitle">Create admin accounts, change account passwords, and manage access roles in one place.</p></header>
    {notice && <p className="user-role-notice" role="status">{notice}</p>}
    <section className="section-card account-create-card"><h2>Add admin account</h2><p>Changing a password signs that account out. For new technicians, configure specialization and schedule under Technicians.</p><form className="admin-create-form" onSubmit={createAdmin}>
      <label>Full name<input required minLength="2" maxLength="100" autoComplete="name" value={adminForm.name} onChange={event => setAdminForm({ ...adminForm, name: event.target.value })} /></label>
      <label>Email<input required type="email" maxLength="254" autoComplete="email" value={adminForm.email} onChange={event => setAdminForm({ ...adminForm, email: event.target.value })} /></label>
      <label>Mobile (optional)<input type="tel" autoComplete="tel" value={adminForm.mobile} onChange={event => setAdminForm({ ...adminForm, mobile: event.target.value })} /></label>
      <label>Password<input required type="password" minLength="8" autoComplete="new-password" value={adminForm.password} onChange={event => setAdminForm({ ...adminForm, password: event.target.value })} /></label>
      <label>Confirm password<input required type="password" minLength="8" autoComplete="new-password" value={adminForm.confirmPassword} onChange={event => setAdminForm({ ...adminForm, confirmPassword: event.target.value })} /></label>
      <button disabled={creating}>{creating ? 'Creating…' : 'Create admin account'}</button>
    </form></section>
    <section className="section-card">
      <label className="user-search">Search accounts<input type="search" placeholder="Name, email or mobile" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
      {error && <p role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
      {loading ? <p role="status">Loading accounts…</p> : accounts.length ? <div className="user-role-list">{accounts.map(account => <RoleRow key={`${account.id}-${account.role}`} account={account} ownAccount={String(user?._id) === account.id} onSaved={saved} onNotice={setNotice} />)}</div> : <p>No accounts found.</p>}
      <footer className="user-role-pagination"><button disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={loading || page >= pages} onClick={() => setPage(value => value + 1)}>Next</button></footer>
    </section>
  </div>;
}

function RoleRow({ account, ownAccount, onSaved, onNotice }) {
  const [role, setRole] = useState(account.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  async function save(event) {
    event.preventDefault();
    if (saving || role === account.role || ownAccount) return;
    setSaving(true); setError('');
    try {
      const { data } = await api.patch(`/admin/users/${account.id}/role`, { role });
      onSaved(data.user, data.message);
    } catch (error) { setError(error.response?.data?.message || 'Unable to change role.'); }
    finally { setSaving(false); }
  }
  async function changePassword(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const { data } = await api.patch(`/admin/accounts/${account.id}/password`, { password, confirmPassword });
      setPassword(''); setConfirmPassword(''); setResetOpen(false); onNotice(data.message);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to change this password.'); }
    finally { setSaving(false); }
  }
  return <article className="account-role-item">
    <form className="user-role-row" onSubmit={save}>
      <div><strong>{account.name}{ownAccount ? ' (you)' : ''}</strong><span>{account.email}</span><small>{account.isActive ? 'Active' : 'Suspended'} · Current role: {account.role}</small></div>
      <label>Role<select aria-label={`Role for ${account.name}`} value={role} disabled={saving || ownAccount} onChange={event => setRole(event.target.value)}>{roles.map(value => <option key={value}>{value}</option>)}</select></label>
      <button disabled={saving || ownAccount || role === account.role}>{saving ? 'Saving…' : 'Save role'}</button>
      {!ownAccount && <button type="button" onClick={() => { setError(''); setResetOpen(value => !value); setPassword(''); setConfirmPassword(''); }}>{resetOpen ? 'Cancel password change' : 'Change password'}</button>}
      {ownAccount && <small className="user-role-help">Use Account settings to change your own password; another administrator must change your role.</small>}
      {error && <p className="user-role-help" role="alert">{error}</p>}
    </form>
    {resetOpen && <form className="account-password-form" onSubmit={changePassword}><label>New password<input required minLength="8" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label><label>Confirm password<input required minLength="8" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label><button disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button></form>}
  </article>;
}
