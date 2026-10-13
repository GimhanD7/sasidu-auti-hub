import { test } from 'node:test';
import assert from 'node:assert/strict';
import Appointment from '../models/Appointment.js';
import ServiceJob from '../models/ServiceJob.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import { listAdminAllocations, updateAdminJobTechnician } from '../controllers/adminAllocationController.js';
import { listAdminAppointments } from '../controllers/adminDashboardController.js';

const response = () => ({ code: 200, status(code) { this.code = code; return this; }, set() { return this; }, json(data) { this.data = data; return this; } });
const query = data => ({ sort() { return this; }, select() { return this; }, limit() { return this; }, populate() { return this; }, lean: async () => data });
const id = '507f1f77bcf86cd799439011';

test('confirmed technician bookings appear before service starts and support technician search and filtering', async t => {
  const person = { _id: id, name: 'Vijani', availabilityStatus: 'Available' };
  const booking = { _id: 'booking', appointmentNumber: 'APT-20261013-22E1FF', status: 'Confirmed', assignedTechnician: person, createdAt: new Date(), preferredTime: '18:02' };
  let appointmentFilter;
  let jobFilter;
  t.mock.method(Vehicle, 'find', () => query([]));
  t.mock.method(User, 'find', filter => query(filter.role === 'Technician' ? [person] : []));
  t.mock.method(Appointment, 'find', filter => { appointmentFilter = filter; return query([booking]); });
  t.mock.method(Appointment, 'aggregate', async pipeline => {
    assert.ok(pipeline.some(stage => stage.$match?.linkedJobs?.$size === 0));
    return [{ _id: id, count: 1 }];
  });
  t.mock.method(ServiceJob, 'find', filter => { if (!filter.appointment) jobFilter = filter; return query([]); });
  t.mock.method(ServiceJob, 'aggregate', async () => []);
  for (const params of [{}, { search: 'Vijani' }, { technician: id }]) {
    const res = response();
    await listAdminAllocations({ query: params }, res);
    assert.equal(res.code, 200);
    assert.equal(res.data.jobs[0].reference, booking.appointmentNumber);
    assert.equal(res.data.jobs[0].technician, 'Vijani');
    assert.equal(res.data.jobs[0].recordType, 'appointment');
    assert.equal(res.data.technicians[0].pendingAppointments, 1);
    assert.equal(res.data.technicians[0].activeJobs, 0);
    if (params.search) {
      assert.deepEqual(appointmentFilter.$or.at(-1), { assignedTechnician: { $in: [id] } });
      assert.deepEqual(jobFilter.$or.at(-1), { technician: { $in: [id] } });
    }
    if (params.technician) {
      assert.equal(appointmentFilter.assignedTechnician, id);
      assert.equal(jobFilter.technician, id);
    }
  }
});

test('allocation rejects an invalid technician filter', async () => {
  const res = response();
  await listAdminAllocations({ query: { technician: 'invalid' } }, res);
  assert.equal(res.code, 400);
});

test('allocation lists pending appointments and completed jobs without duplicate linked appointments', async t => {
  const base = { customer: { name: 'Customer' }, vehicle: { make: 'Toyota', model: 'Prius', registrationNumber: 'ABC-1234' }, preferredDate: new Date('2026-10-20'), preferredTime: '10:37', serviceType: 'Oil service' };
  t.mock.method(Appointment, 'find', () => query([
    { ...base, _id: 'pending', status: 'Pending', createdAt: new Date('2026-10-13') },
    { ...base, _id: 'linked', status: 'Confirmed', createdAt: new Date('2026-10-11') },
  ]));
  t.mock.method(User, 'find', () => query([{ _id: id, name: 'Technician', availabilityStatus: 'Busy' }]));
  t.mock.method(ServiceJob, 'aggregate', async () => []);
  t.mock.method(Appointment, 'aggregate', async () => []);
  let finds = 0;
  t.mock.method(ServiceJob, 'find', () => ++finds === 1 ? query([
    { _id: 'ready', ...base, status: 'Ready', technician: { _id: id, name: 'Technician', availabilityStatus: 'Busy' }, createdAt: new Date('2026-10-12'), appointment: base },
    { _id: 'active', ...base, status: 'In Progress', createdAt: new Date('2026-10-11'), appointment: base },
  ]) : query([{ appointment: 'linked' }]));
  const res = response();
  await listAdminAllocations({ query: {} }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.data.jobs.map(item => item.id), ['pending', 'ready', 'active']);
  assert.equal(res.data.jobs[0].recordType, 'appointment');
  assert.equal(res.data.jobs[0].preferredTime, '10:37');
  assert.equal(res.data.jobs[1].canAssign, false);
  assert.equal(res.data.jobs[1].availabilityStatus, 'Busy');
  assert.equal(res.data.jobs[2].canAssign, true);
  assert.ok(res.data.jobs.every(item => item.customer === 'Customer' && item.registrationNumber === 'ABC-1234'));
});

test('completed jobs remain unavailable for reassignment on the server', async t => {
  t.mock.method(ServiceJob, 'findOne', async filter => {
    assert.ok(!filter.status.$in.includes('Ready'));
    return null;
  });
  const res = response();
  await updateAdminJobTechnician({ params: { jobId: id }, body: { technicianId: id } }, res);
  assert.equal(res.code, 404);
});

test('admin appointment list requests newest bookings first and supplies vehicle number', async t => {
  let appointmentQueries = 0;
  t.mock.method(Appointment, 'find', () => {
    if (++appointmentQueries !== 1) return query([]);
    const chain = query([{ _id: id, customer: { name: 'Customer' }, vehicle: { make: 'Toyota', model: 'Prius', registrationNumber: 'ABC-1234' }, preferredDate: new Date('2026-10-20'), preferredTime: '10:37', status: 'Pending' }]);
    chain.sort = order => { assert.deepEqual(order, { createdAt: -1, _id: -1 }); return chain; };
    return chain;
  });
  t.mock.method(User, 'find', () => query([]));
  const res = response();
  await listAdminAppointments({ query: {} }, res);
  assert.equal(res.code, 200);
  assert.equal(res.data.appointments[0].registrationNumber, 'ABC-1234');
});
