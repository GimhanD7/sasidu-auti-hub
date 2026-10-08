import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import './AdminServiceTypes.css';

const blank = { name: '', defaultDurationMinutes: 60, estimatedCost: 0, requiredSkill: '' };
const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(value || 0);

export default function AdminServiceTypes() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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

  async function deactivate(item) {
    try { await api.delete(`/admin/service-types/${item.id}`); setNotice(`${item.name} was deactivated and is no longer bookable.`); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to deactivate this service type.'); }
  }

  return <div className="admin-service-types-page">
    <header className="service-types-heading"><div><h1 className="page-title">Service Type Management</h1><p className="page-subtitle">Set the services customers can book, their standard duration, estimated cost, and required skill.</p></div><button className="service-types-primary" onClick={() => { setEditingId(''); setForm({ ...blank }); setError(''); }}>+ Add service type</button></header>
    {notice && <p className="service-types-notice" role="status">{notice}</p>}{error && <p className="service-types-error" role="alert">{error}</p>}
    {form && <section className="section-card service-type-editor"><header><h2>{editingId ? 'Edit service type' : 'Add service type'}</h2><button type="button" onClick={() => setForm(null)} aria-label="Close form">×</button></header><form onSubmit={save}>
      <label>Service name<input required maxLength="100" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label>Default duration (minutes)<input required type="number" min="15" max="1440" step="15" value={form.defaultDurationMinutes} onChange={event => setForm({ ...form, defaultDurationMinutes: event.target.value })} /></label>
      <label>Estimated cost (LKR)<input required type="number" min="0" max="10000000" step="100" value={form.estimatedCost} onChange={event => setForm({ ...form, estimatedCost: event.target.value })} /></label>
      <label>Required technician skill<input required maxLength="100" value={form.requiredSkill} onChange={event => setForm({ ...form, requiredSkill: event.target.value })} placeholder="e.g. Brake Systems" /></label>
      <footer><button type="button" className="service-types-secondary" onClick={() => setForm(null)} disabled={saving}>Cancel</button><button className="service-types-primary" disabled={saving}>{saving ? 'Saving…' : 'Save service type'}</button></footer>
    </form></section>}
    <section className="section-card service-type-list"><header><h2>Services</h2><span>{items.filter(item => item.isActive).length} active</span></header>
      {loading ? <p role="status">Loading service types…</p> : items.length ? <div className="service-type-grid">{items.map(item => <article className={!item.isActive ? 'inactive' : ''} key={item.id}><header><h3>{item.name}</h3><span className={item.isActive ? 'active' : ''}>{item.isActive ? 'Active' : 'Inactive'}</span></header><dl><div><dt>Duration</dt><dd>{item.defaultDurationMinutes} minutes</dd></div><div><dt>Estimated cost</dt><dd>{money(item.estimatedCost)}</dd></div><div><dt>Required skill</dt><dd>{item.requiredSkill}</dd></div></dl><footer><button type="button" className="service-types-secondary" onClick={() => startEdit(item)}>Edit</button>{item.isActive && <button type="button" className="service-types-danger" onClick={() => deactivate(item)}>Deactivate</button>}</footer></article>)}</div> : <p>No service types available.</p>}
    </section>
  </div>;
}
