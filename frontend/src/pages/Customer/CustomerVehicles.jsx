import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import './CustomerVehicles.css';

const EMPTY_VEHICLE = { registrationNumber: '', make: '', model: '', year: '', fuelType: '', mileage: '', vinNumber: '', imageUrl: '' };
const FUEL_TYPES = ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'LPG', 'Other'];
const MAX_VEHICLE_YEAR = new Date().getFullYear() + 1;
const formatMileage = value => value == null ? 'Not provided' : `${new Intl.NumberFormat().format(value)} km`;
const formatDate = value => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
};

function VehicleForm({ vehicle, saving, error, onClose, onSave }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_VEHICLE, ...vehicle }));
  function change(event) {
    setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  }
  function submit(event) {
    event.preventDefault();
    onSave(form);
  }

  return <div className="vehicle-dialog-backdrop">
    <section className="vehicle-dialog" role="dialog" aria-modal="true" aria-labelledby="vehicle-dialog-title">
      <div className="vehicle-dialog-header"><div><h2 id="vehicle-dialog-title">{vehicle?._id || vehicle?.id ? 'Edit vehicle' : 'Add a vehicle'}</h2><p>Enter the details shown on your vehicle and registration documents.</p></div><button className="vehicle-icon-button" type="button" aria-label="Close" disabled={saving} onClick={onClose}>×</button></div>
      {error && <p className="vehicle-feedback error" role="alert">{error}</p>}
      <form className="vehicle-form" onSubmit={submit}>
        <div className="vehicle-form-grid">
          <div className="vehicle-form-field"><label htmlFor="vehicle-registration">Registration number *</label><input id="vehicle-registration" name="registrationNumber" autoComplete="off" autoCapitalize="characters" maxLength={25} required value={form.registrationNumber || ''} onChange={change} /></div>
          <div className="vehicle-form-field"><label htmlFor="vehicle-make">Make *</label><input id="vehicle-make" name="make" autoComplete="off" maxLength={80} required value={form.make || ''} onChange={change} /></div>
          <div className="vehicle-form-field"><label htmlFor="vehicle-model">Model *</label><input id="vehicle-model" name="model" autoComplete="off" maxLength={80} required value={form.model || ''} onChange={change} /></div>
          <div className="vehicle-form-field"><label htmlFor="vehicle-year">Year</label><input id="vehicle-year" name="year" type="number" inputMode="numeric" min="1886" max={MAX_VEHICLE_YEAR} step="1" value={form.year ?? ''} onChange={change} /></div>
          <div className="vehicle-form-field"><label htmlFor="vehicle-fuel">Fuel type</label><input id="vehicle-fuel" name="fuelType" list="vehicle-fuel-types" maxLength={50} value={form.fuelType || ''} onChange={change} /><datalist id="vehicle-fuel-types">{FUEL_TYPES.map(type => <option key={type} value={type} />)}</datalist></div>
          <div className="vehicle-form-field"><label htmlFor="vehicle-mileage">Mileage (km)</label><input id="vehicle-mileage" name="mileage" type="number" inputMode="numeric" min="0" max="99999999" step="any" value={form.mileage ?? ''} onChange={change} /></div>
          <div className="vehicle-form-field vehicle-form-wide"><label htmlFor="vehicle-vin">VIN / chassis number</label><input id="vehicle-vin" name="vinNumber" autoComplete="off" maxLength={32} value={form.vinNumber || ''} onChange={change} /></div>
          <div className="vehicle-form-field vehicle-form-wide"><label htmlFor="vehicle-image-url">Vehicle image URL (optional)</label><input id="vehicle-image-url" name="imageUrl" type="url" placeholder="https://example.com/vehicle.jpg" maxLength={2048} value={form.imageUrl || ''} onChange={change} /><small>Use an HTTPS image URL. Images are optional.</small></div>
        </div>
        <div className="vehicle-form-actions"><button type="button" className="btn-outline" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="btn-primary vehicle-save-button" disabled={saving}>{saving ? 'Saving…' : vehicle?._id || vehicle?.id ? 'Save changes' : 'Add vehicle'}</button></div>
      </form>
    </section>
  </div>;
}

function VehicleCard({ vehicle, deleting, confirmDelete, onEdit, onRequestDelete, onCancelDelete, onDelete }) {
  return <article className="vehicle-card">
    <div className="vehicle-image-wrapper">
      {vehicle.imageUrl ? <img src={vehicle.imageUrl} alt={`${vehicle.make} ${vehicle.model}`} className="vehicle-image" loading="lazy" referrerPolicy="no-referrer" /> : <div className="vehicle-photo-placeholder" aria-label="No vehicle image provided">🚗</div>}
      <span className="status-badge vehicle-status-neutral">Registered vehicle</span>
    </div>
    <div className="vehicle-info">
      <div className="vehicle-title-row"><h2>{vehicle.make} {vehicle.model}</h2><span className="reg-badge">{vehicle.registrationNumber}</span></div>
      <p className="vehicle-specs">{[vehicle.year, vehicle.fuelType, vehicle.mileage == null ? null : formatMileage(vehicle.mileage)].filter(Boolean).join(' · ') || 'Details not provided'}</p>
      <details className="vehicle-details"><summary>View vehicle details</summary><dl>
        <div><dt>Registration number</dt><dd>{vehicle.registrationNumber}</dd></div>
        <div><dt>Make</dt><dd>{vehicle.make}</dd></div>
        <div><dt>Model</dt><dd>{vehicle.model}</dd></div>
        <div><dt>Year</dt><dd>{vehicle.year || 'Not provided'}</dd></div>
        <div><dt>Fuel type</dt><dd>{vehicle.fuelType || 'Not provided'}</dd></div>
        <div><dt>Mileage</dt><dd>{formatMileage(vehicle.mileage)}</dd></div>
        <div><dt>VIN / chassis number</dt><dd>{vehicle.vinNumber || 'Not provided'}</dd></div>
        <div><dt>Added</dt><dd>{formatDate(vehicle.createdAt)}</dd></div>
      </dl></details>
      <div className="vehicle-card-actions"><Link className="view-details-btn vehicle-profile-link" to={`/customer/vehicles/${vehicle._id || vehicle.id}`}>Vehicle profile</Link><button className="view-details-btn" type="button" onClick={() => onEdit(vehicle)}>Edit details</button>{confirmDelete ? <div className="vehicle-delete-confirm"><p>Removal is allowed only when there are no appointments or repair records.</p><div><button className="btn-outline" type="button" onClick={onCancelDelete} disabled={deleting}>Keep vehicle</button><button className="vehicle-delete-button" type="button" onClick={() => onDelete(vehicle)} disabled={deleting}>{deleting ? 'Removing…' : 'Confirm removal'}</button></div></div> : <button className="vehicle-delete-trigger" type="button" onClick={onRequestDelete}>Remove</button>}</div>
    </div>
  </article>;
}

export default function CustomerVehicles() {
  const [vehicles, setVehicles] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    api.get('/vehicles', { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) { setVehicles(response.data); setLoadError(''); } })
      .catch(error => { if (!controller.signal.aborted) setLoadError(error.response?.data?.message || 'Unable to load your vehicles. Please try again.'); });
    return () => controller.abort();
  }, [retry]);

  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    const query = search.trim().toLocaleLowerCase();
    const matches = vehicles.filter(vehicle => [vehicle.registrationNumber, vehicle.make, vehicle.model, vehicle.year, vehicle.fuelType, vehicle.vinNumber]
      .filter(value => value != null).some(value => String(value).toLocaleLowerCase().includes(query)));
    return [...matches].sort((a, b) => {
      if (sort === 'name') return `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`);
      if (sort === 'year') return (b.year || 0) - (a.year || 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [vehicles, search, sort]);

  function openAdd() { setFormError(''); setEditingVehicle({ ...EMPTY_VEHICLE }); }
  function openEdit(vehicle) { setFormError(''); setEditingVehicle(vehicle); }
  function closeForm() { if (!saving) { setEditingVehicle(null); setFormError(''); } }

  async function saveVehicle(form) {
    if (saving) return;
    setSaving(true);
    setFormError('');
    const id = editingVehicle?._id || editingVehicle?.id;
    const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== undefined));
    try {
      const response = id ? await api.patch(`/vehicles/${id}`, payload) : await api.post('/vehicles', payload);
      setVehicles(previous => id
        ? previous.map(vehicle => (vehicle._id || vehicle.id) === id ? response.data : vehicle)
        : [response.data, ...previous]);
      setEditingVehicle(null);
      setPageError('');
    } catch (error) {
      setFormError(error.response?.data?.message || 'Unable to save this vehicle. Please try again.');
    } finally { setSaving(false); }
  }

  async function removeVehicle(vehicle) {
    const id = vehicle._id || vehicle.id;
    if (deletingId) return;
    setDeletingId(id);
    setPageError('');
    try {
      await api.delete(`/vehicles/${id}`);
      setVehicles(previous => previous.filter(item => (item._id || item.id) !== id));
      setConfirmDeleteId(null);
    } catch (error) {
      setPageError(error.response?.data?.message || 'Unable to remove this vehicle. Please try again.');
      setConfirmDeleteId(null);
    } finally { setDeletingId(null); }
  }

  return <div className="vehicles-container">
    <div className="vehicles-header"><div><h1 className="page-title">MY VEHICLES</h1><p className="page-subtitle">Manage the vehicles registered to your account.</p></div><button className="btn-primary vehicle-add-button" type="button" onClick={openAdd}>+ ADD VEHICLE</button></div>
    {pageError && <div className="vehicle-feedback error" role="alert">{pageError}</div>}
    {loadError && <div className="vehicle-feedback error" role="alert"><p>{loadError}</p><button className="btn-outline" type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    <div className="vehicles-toolbar"><div className="search-bar"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><input type="search" aria-label="Search vehicles" placeholder="Search registration, make, model or VIN…" value={search} onChange={event => setSearch(event.target.value)} /></div><label className="vehicle-sort">Sort by<select aria-label="Sort vehicles" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Recently added</option><option value="name">Make and model</option><option value="year">Newest model year</option></select></label></div>
    {vehicles === null && !loadError ? <p className="vehicle-feedback" role="status">Loading your vehicles…</p> : null}
    {vehicles && !loadError && <>
      <p className="vehicle-result-count">{filteredVehicles.length} {filteredVehicles.length === 1 ? 'vehicle' : 'vehicles'}{search.trim() ? ` matching “${search.trim()}”` : ''}</p>
      {filteredVehicles.length > 0 && <div className="vehicles-grid">{filteredVehicles.map(vehicle => <VehicleCard key={vehicle._id || vehicle.id} vehicle={vehicle} deleting={deletingId === (vehicle._id || vehicle.id)} confirmDelete={confirmDeleteId === (vehicle._id || vehicle.id)} onEdit={openEdit} onRequestDelete={() => { setPageError(''); setConfirmDeleteId(vehicle._id || vehicle.id); }} onCancelDelete={() => setConfirmDeleteId(null)} onDelete={removeVehicle} />)}
        <button className="add-vehicle-card" type="button" onClick={openAdd}><span className="add-icon" aria-hidden="true">+</span><strong>REGISTER A VEHICLE</strong><span>Add a vehicle to your account.</span></button>
      </div>}
      {!filteredVehicles.length && <div className="vehicle-empty-state"><h2>{vehicles.length ? 'No matching vehicles' : 'No vehicles registered yet'}</h2><p>{vehicles.length ? 'Try another registration number, make, model or VIN.' : 'Add your first vehicle to keep its service information in one place.'}</p>{vehicles.length ? <button className="btn-outline" type="button" onClick={() => setSearch('')}>Clear search</button> : <button className="btn-primary vehicle-add-button" type="button" onClick={openAdd}>+ ADD VEHICLE</button>}</div>}
    </>}
    {editingVehicle && <VehicleForm vehicle={editingVehicle} saving={saving} error={formError} onClose={closeForm} onSave={saveVehicle} />}
    <p className="vehicles-dashboard-link"><Link to="/customer/dashboard">Back to dashboard</Link></p>
  </div>;
}
