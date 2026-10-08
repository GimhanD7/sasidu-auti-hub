import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../auth/useAuth';
import './AdminUsers.css';

const roles = ['Customer', 'Technician', 'Finance', 'Admin'];

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

  return <div className="admin-users-page">
    <header><h1 className="page-title">User Roles</h1><p className="page-subtitle">Manage access for customer and staff accounts.</p></header>
    <p>Changing a role signs the account out. Existing records are kept. For a new technician, configure their specialization and schedule in Technicians.</p>
    {notice && <p className="user-role-notice" role="status">{notice}</p>}
    <section className="section-card">
      <label className="user-search">Search accounts<input type="search" placeholder="Name, email or mobile" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
      {error && <p role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
      {loading ? <p role="status">Loading accounts…</p> : accounts.length ? <div className="user-role-list">{accounts.map(account => <RoleRow key={`${account.id}-${account.role}`} account={account} ownAccount={String(user?._id) === account.id} onSaved={saved} />)}</div> : <p>No accounts found.</p>}
      <footer className="user-role-pagination"><button disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={loading || page >= pages} onClick={() => setPage(value => value + 1)}>Next</button></footer>
    </section>
  </div>;
}

function RoleRow({ account, ownAccount, onSaved }) {
  const [role, setRole] = useState(account.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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
  return <form className="user-role-row" onSubmit={save}>
    <div><strong>{account.name}{ownAccount ? ' (you)' : ''}</strong><span>{account.email}</span><small>{account.isActive ? 'Active' : 'Suspended'} · Current role: {account.role}</small></div>
    <label>Role<select aria-label={`Role for ${account.name}`} value={role} disabled={saving || ownAccount} onChange={event => setRole(event.target.value)}>{roles.map(value => <option key={value}>{value}</option>)}</select></label>
    <button disabled={saving || ownAccount || role === account.role}>{saving ? 'Saving…' : 'Save role'}</button>
    {ownAccount && <small className="user-role-help">Another administrator must change your role.</small>}
    {error && <p className="user-role-help" role="alert">{error}</p>}
  </form>;
}
