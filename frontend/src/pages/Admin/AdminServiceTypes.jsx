import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import './AdminServiceTypes.css';

const blank = { name: '', defaultDurationMinutes: 60, estimatedCost: 0, requiredSkill: '' };
const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(value || 0);
const duration = value => `${Math.floor(value / 60) ? `${Math.floor(value / 60)} hr${Math.floor(value / 60) === 1 ? '' : 's'} ` : ''}${value % 60 ? `${value % 60} min` : ''}`.trim() || '—';

export default function AdminServiceTypes() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/admin/service-types'); setItems(data.serviceTypes); setError(''); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load service types.'); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let cancelled = false;
    api.get('/admin/service-types').then(({ data }) => { if (!cancelled) { setItems(data.serviceTypes); setError(''); } })
      .catch(requestError => { if (!cancelled) setError(requestError.response?.data?.message || 'Unable to load service types.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function startEdit(item) {
    setEditingId(item.id);
    setForm({ name: item.name, defaultDurationMinutes: item.defaultDurationMinutes, estimatedCost: item.estimatedCost, requiredSkill: item.requiredSkill });
    setError(''); setNotice('');
  }

  async function save(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await api[editingId ? 'patch' : 'post'](editingId ? `/admin/service-types/${editingId}` : '/admin/service-types', form);
      setForm(null); setEditingId(''); setNotice(editingId ? 'Service type updated.' : 'Service type added.'); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to save this service type.'); }
    finally { setSaving(false); }
  }

  async function remove(item) {
    if (!window.confirm(`Delete ${item.name}? Existing service history will be preserved.`)) return;
    setSaving(true); setError('');
    try { const { data } = await api.delete(`/admin/service-types/${item.id}`); setNotice(data.message); await load(); }
    catch (error) { setError(error.response?.data?.message || 'Unable to delete service type.'); }
    finally { setSaving(false); }
  }
  async function deactivate(item) {
    setSaving(true); setError('');
    try { await api.patch(`/admin/service-types/${item.id}/deactivate`); setNotice(`${item.name} was deactivated and is no longer bookable.`); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to deactivate this service type.'); }
    finally { setSaving(false); }
  }
  async function activate(item) {
    setSaving(true); setError('');
    try { await api.patch(`/admin/service-types/${item.id}/activate`); setNotice(`${item.name} is active and available for booking.`); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to activate this service type.'); }
    finally { setSaving(false); }
  }

  const activeCount = items.filter(item => item.isActive).length;
  const averageDuration = items.length ? Math.round(items.reduce((total, item) => total + (Number(item.defaultDurationMinutes) || 0), 0) / items.length) : 0;
  const visibleItems = items.filter(item => {
    const matchesSearch = `${item.name} ${item.requiredSkill}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? item.isActive : !item.isActive);
    return matchesSearch && matchesStatus;
  });

  return <div className="admin-service-types-page">
    <header className="service-types-hero"><div className="service-types-hero-copy"><span className="service-types-eyebrow">WORKSHOP CATALOG</span><h1>Service types</h1><p>Manage the services customers can book, with clear pricing, estimated time, and technician skill requirements.</p></div><button className="service-types-primary service-types-add" onClick={() => { setEditingId(''); setForm({ ...blank }); setError(''); setNotice(''); }}>＋ <span>Add service</span></button></header>
    <section className="service-types-summary" aria-label="Service catalog summary"><article><span>Total services</span><strong>{items.length}</strong><small>In your catalog</small></article><article><span>Bookable now</span><strong>{activeCount}</strong><small>{items.length - activeCount} inactive</small></article><article><span>Typical duration</span><strong>{duration(averageDuration)}</strong><small>Average service time</small></article></section>
    {notice && <p className="service-types-notice" role="status">{notice}</p>}{error && <p className="service-types-error" role="alert">{error}</p>}
    {form && <section className="section-card service-type-editor"><header><div><span className="service-types-eyebrow">SERVICE DETAILS</span><h2>{editingId ? 'Edit service' : 'Add a service'}</h2></div><button type="button" onClick={() => setForm(null)} aria-label="Close form">×</button></header><form onSubmit={save}>
      <label>Service name<input required maxLength="100" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="e.g. Full vehicle service" /></label>
      <label>Estimated duration<input required type="number" min="15" max="1440" step="15" value={form.defaultDurationMinutes} onChange={event => setForm({ ...form, defaultDurationMinutes: event.target.value })} /><small>Minutes · used to plan appointments</small></label>
      <label>Estimated charge<input required type="number" min="0" max="10000000" step="100" value={form.estimatedCost} onChange={event => setForm({ ...form, estimatedCost: event.target.value })} /><small>LKR · shown as an estimate</small></label>
      <label>Required technician skill<input required maxLength="100" value={form.requiredSkill} onChange={event => setForm({ ...form, requiredSkill: event.target.value })} placeholder="e.g. Brake systems" /></label>
      <footer><button type="button" className="service-types-secondary" onClick={() => setForm(null)} disabled={saving}>Cancel</button><button className="service-types-primary" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add service'}</button></footer>
    </form></section>}
    <section className="service-type-catalog"><header className="service-type-catalog-heading"><div><span className="service-types-eyebrow">CATALOG</span><h2>All services <span>{visibleItems.length}</span></h2></div><div className="service-type-controls"><label className="service-type-search"><span className="sr-only">Search services</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input type="search" placeholder="Search services or skills" value={search} onChange={event => setSearch(event.target.value)} /></label><label className="sr-only" htmlFor="service-status-filter">Filter by status</label><select id="service-status-filter" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div></header>
      {loading ? <div className="service-types-empty" role="status">Loading service catalog…</div> : visibleItems.length ? <div className="service-type-grid">{visibleItems.map(item => <article className={`service-type-card${item.isActive ? '' : ' inactive'}`} key={item.id}><header className="service-card-title"><span className="service-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3 3.7-3.7Z"/><path d="m4 4 3 3"/></svg></span><span className={`service-status ${item.isActive ? 'active' : ''}`}><i />{item.isActive ? 'Active' : 'Inactive'}</span></header><h3>{item.name}</h3><div className="service-card-price"><strong>{money(item.estimatedCost)}</strong><span>estimated charge</span></div><dl><div><dt>Duration</dt><dd>{duration(Number(item.defaultDurationMinutes) || 0)}</dd></div><div><dt>Technician skill</dt><dd>{item.requiredSkill || 'Not specified'}</dd></div></dl><footer><button type="button" className="service-types-secondary" onClick={() => startEdit(item)}>Edit details</button>{item.isActive ? <button type="button" className="service-types-danger" disabled={saving} onClick={() => deactivate(item)}>Deactivate</button> : <button type="button" className="service-types-activate" disabled={saving} onClick={() => activate(item)}>Activate</button>}<button type="button" className="service-types-danger service-delete" disabled={saving} onClick={() => remove(item)}>Delete</button></footer></article>)}</div> : <div className="service-types-empty"><strong>{items.length ? 'No matching services' : 'Your catalog is empty'}</strong><span>{items.length ? 'Try another search or status filter.' : 'Add your first service to make it available for bookings.'}</span>{!items.length && <button className="service-types-primary" onClick={() => { setEditingId(''); setForm({ ...blank }); }}>Add your first service</button>}</div>}
    </section>
  </div>;
}
