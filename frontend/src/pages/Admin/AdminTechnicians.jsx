import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import './AdminTechnicians.css';

const week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const initialForm = {
  name: '',
  email: '',
  mobile: '',
  technicianSpecialization: '',
  workSchedule: { days: [1, 2, 3, 4, 5, 6], startTime: '09:00', endTime: '17:00' },
};
const dateText = (value) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '—';

export default function AdminTechnicians() {
  const [search, setSearch] = useState('');
  const [technicians, setTechnicians] = useState([]);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadDirectory(query = search) {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/technicians', {
        params: query ? { search: query } : {},
      });
      setTechnicians(data.technicians);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load technicians.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      () =>
        api
          .get('/admin/technicians', { params: search ? { search } : {} })
          .then(({ data }) => {
            if (!cancelled) {
              setTechnicians(data.technicians);
              setError('');
            }
          })
          .catch((requestError) => {
            if (!cancelled)
              setError(requestError.response?.data?.message || 'Unable to load technicians.');
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          }),
      search ? 250 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  async function openProfile(id) {
    setSelected(id);
    setDetails(null);
    setError('');
    try {
      const { data } = await api.get(`/admin/technicians/${id}`);
      setDetails(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load technician profile.');
    }
  }

  function startEdit(technician) {
    setEditingId(technician?.id || '');
    setForm(
      technician
        ? {
            name: technician.name,
            email: technician.email,
            mobile: technician.mobile || '',
            technicianSpecialization:
              technician.specialization === 'Not set' ? '' : technician.specialization,
            workSchedule: { ...technician.workSchedule, days: technician.workSchedule.days || [] },
          }
        : structuredClone(initialForm),
    );
    setError('');
    setNotice('');
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await api[editingId ? 'patch' : 'post'](
        editingId ? `/admin/technicians/${editingId}` : '/admin/technicians',
        form,
      );
      const message = editingId
        ? 'Technician profile updated.'
        : `Technician added. Default password: 12345678. Change it in Account settings.${data.accountSetupEmailSent ? ' A password setup email was also sent.' : ''}`;
      setForm(null);
      setNotice(message);
      await loadDirectory();
      if (editingId) await openProfile(editingId);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save technician profile.');
    } finally {
      setSaving(false);
    }
  }

  async function updateAvailability(id, availabilityStatus) {
    setAvailabilitySaving(id);
    setError('');
    try {
      await api.patch(`/admin/technicians/${id}/availability`, { availabilityStatus });
      setTechnicians((current) =>
        current.map((item) => (item.id === id ? { ...item, availabilityStatus } : item)),
      );
      setDetails((current) =>
        current?.technician.id === id
          ? { ...current, technician: { ...current.technician, availabilityStatus } }
          : current,
      );
      setNotice(`Technician availability set to ${availabilityStatus}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update technician availability.');
    } finally {
      setAvailabilitySaving('');
    }
  }

  function toggleDay(day) {
    const days = form.workSchedule.days.includes(day)
      ? form.workSchedule.days.filter((value) => value !== day)
      : [...form.workSchedule.days, day];
    setForm({ ...form, workSchedule: { ...form.workSchedule, days: days.sort() } });
  }

  if (selected)
    return (
      <div className="admin-technicians-page">
        <header className="admin-technicians-heading">
          <div>
            <button
              className="technician-back"
              onClick={() => {
                setSelected(null);
                setDetails(null);
              }}
            >
              ← All technicians
            </button>
            <h1 className="page-title">Technician profile</h1>
          </div>
          {details && (
            <button className="technician-primary" onClick={() => startEdit(details.technician)}>
              Edit profile
            </button>
          )}
        </header>
        {notice && (
          <p className="technician-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="technician-error" role="alert">
            {error}
          </p>
        )}
        {!details ? (
          <p role="status">Loading technician…</p>
        ) : (
          <>
            <section className="section-card technician-profile">
              <div>
                <h2>{details.technician.name}</h2>
                <p>
                  {details.technician.email}
                  {details.technician.mobile ? ` · ${details.technician.mobile}` : ''}
                </p>
                <strong>{details.technician.specialization}</strong>
                <label className="technician-availability-control">
                  Availability status
                  <select
                    value={details.technician.availabilityStatus}
                    disabled={availabilitySaving === details.technician.id}
                    onChange={(event) =>
                      updateAvailability(details.technician.id, event.target.value)
                    }
                  >
                    {['Available', 'Busy', 'Break', 'Off Duty', 'Leave'].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="technician-hours">
                <strong>Weekly work schedule</strong>
                <span>
                  {details.technician.workSchedule.days.map((day) => week[day - 1]).join(', ') ||
                    'No days set'}
                </span>
                <span>
                  {details.technician.workSchedule.startTime}–
                  {details.technician.workSchedule.endTime}
                </span>
              </div>
            </section>
            <section className="technician-stat-grid">
              <article>
                <strong>{details.summary.activeJobs}</strong>
                <span>Active jobs</span>
              </article>
              <article>
                <strong>{details.summary.readyJobs}</strong>
                <span>Ready jobs</span>
              </article>
              <article>
                <strong>{details.summary.appointments}</strong>
                <span>Open appointments</span>
              </article>
            </section>
            <section className="section-card technician-table-section">
              <header>
                <h2>Assigned and completed jobs</h2>
                <span>{details.jobs.length} records</span>
              </header>
              {details.jobs.length ? (
                <div className="technician-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th>Service</th>
                        <th>Customer / vehicle</th>
                        <th>Status</th>
                        <th>Last updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.jobs.map((job) => (
                        <tr key={job.id}>
                          <td>{job.reference}</td>
                          <td>{job.serviceType}</td>
                          <td>
                            {job.customer}
                            <br />
                            <small>{job.vehicle}</small>
                          </td>
                          <td>
                            <span
                              className={`technician-status ${job.status.toLowerCase().replaceAll(' ', '-')}`}
                            >
                              {job.status}
                            </span>
                          </td>
                          <td>{dateText(job.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No service jobs are assigned to this technician.</p>
              )}
            </section>
            <section className="section-card technician-table-section">
              <header>
                <h2>Appointment work schedule</h2>
                <span>{details.appointments.length} records</span>
              </header>
              {details.appointments.length ? (
                <div className="technician-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date / time</th>
                        <th>Appointment</th>
                        <th>Service</th>
                        <th>Customer / vehicle</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.appointments.map((item) => (
                        <tr key={item.id}>
                          <td>
                            {dateText(item.preferredDate)}
                            <br />
                            {item.preferredTime}
                          </td>
                          <td>{item.reference}</td>
                          <td>{item.serviceType}</td>
                          <td>
                            {item.customer}
                            <br />
                            <small>{item.vehicle}</small>
                          </td>
                          <td>{item.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No appointments are assigned to this technician.</p>
              )}
            </section>
          </>
        )}
        {form && (
          <TechnicianForm
            form={form}
            setForm={setForm}
            toggleDay={toggleDay}
            editing={Boolean(editingId)}
            saving={saving}
            error={error}
            onSubmit={save}
            onClose={() => setForm(null)}
          />
        )}
      </div>
    );

  return (
    <div className="admin-technicians-page">
      <header className="admin-technicians-heading">
        <div>
          <h1 className="page-title">Technician Management</h1>
          <p className="page-subtitle">
            Manage technician profiles, specializations, weekly work schedules, and job workload.
          </p>
        </div>
        <button className="technician-primary" onClick={() => startEdit(null)}>
          + Add technician
        </button>
      </header>
      {notice && (
        <p className="technician-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="technician-error" role="alert">
          {error}
        </p>
      )}
      <section className="section-card technician-directory">
        <div className="technician-toolbar">
          <label>
            Search technicians
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email, phone, specialization…"
            />
          </label>
          <span>
            {technicians.length} technician{technicians.length === 1 ? '' : 's'}
          </span>
        </div>
        {loading ? (
          <p role="status">Loading technicians…</p>
        ) : technicians.length ? (
          <div className="technician-list">
            {technicians.map((item) => (
              <article className="technician-row" key={item.id}>
                <button className="technician-row-open" onClick={() => openProfile(item.id)}>
                  <span className="technician-avatar">
                    {item.name
                      .split(/\s+/)
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </span>
                  <span className="technician-identity">
                    <strong>{item.name}</strong>
                    <small>
                      {item.email} · {item.specialization}
                    </small>
                    <small>
                      Works{' '}
                      {item.workSchedule.days.map((day) => week[day - 1]).join(', ') || 'no days'} ·{' '}
                      {item.workSchedule.startTime}–{item.workSchedule.endTime}
                    </small>
                  </span>
                  <span className="technician-workload">
                    <strong>{item.activeJobs} active</strong>
                    <small>
                      {item.readyJobs} ready · {item.upcomingAppointments} upcoming appointments
                    </small>
                  </span>
                </button>
                <label className="technician-row-status">
                  Status
                  <select
                    aria-label={`Availability for ${item.name}`}
                    value={item.availabilityStatus}
                    disabled={availabilitySaving === item.id}
                    onChange={(event) => updateAvailability(item.id, event.target.value)}
                  >
                    {['Available', 'Busy', 'Break', 'Off Duty', 'Leave'].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </article>
            ))}
          </div>
        ) : (
          <p>No technicians found.</p>
        )}
      </section>
      {form && (
        <TechnicianForm
          form={form}
          setForm={setForm}
          toggleDay={toggleDay}
          editing={Boolean(editingId)}
          saving={saving}
          error={error}
          onSubmit={save}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}

function TechnicianForm({ form, setForm, toggleDay, editing, saving, error, onSubmit, onClose }) {
  return (
    <div className="technician-modal-backdrop">
      <section
        className="technician-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="technician-form-title"
      >
        <header>
          <h2 id="technician-form-title">{editing ? 'Edit technician' : 'Add technician'}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form onSubmit={onSubmit}>
          {error && (
            <p className="technician-error" role="alert">
              {error}
            </p>
          )}
          <label>
            Full name
            <input
              required
              minLength="2"
              maxLength="100"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              maxLength="254"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label>
            Mobile number
            <input
              type="tel"
              value={form.mobile}
              onChange={(event) => setForm({ ...form, mobile: event.target.value })}
              placeholder="Optional"
            />
          </label>
          <label>
            Specialization
            <input
              required
              maxLength="120"
              value={form.technicianSpecialization}
              onChange={(event) =>
                setForm({ ...form, technicianSpecialization: event.target.value })
              }
              placeholder="e.g. Auto Electrical"
            />
          </label>
          {!editing && (
            <p className="technician-notice">
              Default password: <strong>12345678</strong>. The technician can change it in Account
              settings.
            </p>
          )}
          <fieldset className="technician-days">
            <legend>Working days</legend>
            {week.map((day, index) => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={form.workSchedule.days.includes(index + 1)}
                  onChange={() => toggleDay(index + 1)}
                />
                {day}
              </label>
            ))}
          </fieldset>
          <div className="technician-time-fields">
            <label>
              Start time
              <input
                type="time"
                required
                value={form.workSchedule.startTime}
                onChange={(event) =>
                  setForm({
                    ...form,
                    workSchedule: { ...form.workSchedule, startTime: event.target.value },
                  })
                }
              />
            </label>
            <label>
              End time
              <input
                type="time"
                required
                value={form.workSchedule.endTime}
                onChange={(event) =>
                  setForm({
                    ...form,
                    workSchedule: { ...form.workSchedule, endTime: event.target.value },
                  })
                }
              />
            </label>
          </div>
          <footer>
            <button
              type="button"
              className="technician-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button className="technician-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create technician'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
