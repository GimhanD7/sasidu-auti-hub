import { test } from 'node:test';
import assert from 'node:assert/strict';
import Appointment from '../models/Appointment.js';
import ServiceJob from '../models/ServiceJob.js';
import ServiceType from '../models/ServiceType.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import Notification from '../models/Notification.js';
import { updateAdminAppointment, createAdminAppointment, convertAdminAppointmentToJob } from '../controllers/adminAppointmentController.js';

const id = '507f1f77bcf86cd799439011';
test('admin saves custom service text without changing issue classification or starting a job', async t => {
  let saves = 0;
  const appointment = { _id: id, preferredDate: new Date('2026-01-01'), preferredTime: '09:00', status: 'Pending', serviceType: 'Issue assessment', issueType: 'Other', history: [], async save() { saves++; } };
  t.mock.method(Appointment, 'findById', () => ({ select: async () => appointment }));
  t.mock.method(ServiceJob, 'findOne', async () => null);
  t.mock.method(ServiceJob, 'create', () => assert.fail('Saving must not create a job'));
  const update = async serviceType => {
    const res = { code: 200, status(code) { this.code = code; return this; }, set() { return this; }, json(data) { this.data = data; return this; } };
    await updateAdminAppointment({ params: { appointmentId: id }, user: { _id: id }, body: { serviceType, technicianId: '' } }, res);
    return res;
  };
  assert.equal((await update('  full service  ')).code, 200);
  assert.equal(appointment.serviceType, 'full service');
  assert.equal(appointment.issueType, 'Other');
  assert.equal(appointment.status, 'Pending');
  assert.equal(appointment.assignedTechnician, undefined);
  assert.equal((await update('Custom brake inspection')).code, 200);
  for (const value of ['', '   ', null, 123, {}, 'a'.repeat(201)]) {
    assert.equal((await update(value)).code, 400);
  }
  assert.equal(saves, 2);
});

const response = () => ({ code: 200, status(code) { this.code = code; return this; }, set() { return this; }, json(data) { this.data = data; return this; } });

test('admin creates a custom booking with no service catalog lookup and no default price', async t => {
  t.mock.method(ServiceType, 'findOne', () => assert.fail('Custom bookings must not query the service catalog'));
  t.mock.method(Appointment, 'exists', async () => false);
  t.mock.method(User, 'findOne', () => ({ select: async () => ({ _id: id, name: 'Customer', email: 'customer@example.test' }) }));
  t.mock.method(Vehicle, 'findOne', () => ({ select: async () => ({ _id: id, make: 'Toyota', model: 'Prius' }) }));
  t.mock.method(Notification, 'create', async () => ({}));
  let created;
  t.mock.method(Appointment, 'create', async data => (created = data));
  const res = response();
  await createAdminAppointment({ user: { _id: id }, body: { customerId: id, vehicleId: id, serviceType: '  My custom inspection  ', issueType: 'Other', preferredDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), preferredTime: '10:37' } }, res);
  assert.equal(res.code, 201);
  assert.equal(created.serviceType, 'My custom inspection');
  assert.equal(created.estimatedCost, undefined);
  assert.equal(created.status, 'Pending');
});

test('cancellation releases the booking and progress cannot be manually selected', async t => {
  let appointment;
  t.mock.method(Appointment, 'findById', () => ({ select: async () => appointment, then: resolve => resolve(appointment) }));
  t.mock.method(ServiceJob, 'findOne', async () => null);
  t.mock.method(Notification, 'create', async () => ({}));
  const reset = (status = 'Pending') => {
    appointment = { _id: id, customer: id, preferredDate: new Date('2026-01-01'), preferredTime: '09:00', bookingSlotKey: '2026-01-01|09:00', status, serviceType: 'Custom service', history: [], updatedAt: new Date(), async save() {} };
  };
  const update = async body => {
    const res = response();
    await updateAdminAppointment({ params: { appointmentId: id }, user: { _id: id }, body }, res);
    return res;
  };
  reset();
  assert.equal((await update({ status: 'Confirmed' })).code, 400, 'Confirmation requires a technician');
  for (const status of ['In Service', 'Completed']) {
    reset();
    assert.equal((await update({ status })).code, 400);
  }
  reset();
  appointment.cancellationRequest = { status: 'Pending', requestedAt: new Date() };
  assert.equal((await update({ status: 'Cancelled' })).code, 200);
  assert.equal(appointment.cancellationRequest.status, 'Approved');
  assert.ok(appointment.cancellationRequest.respondedAt instanceof Date);
  assert.equal(appointment.bookingSlotKey, undefined);
  assert.equal((await update({ status: 'Pending' })).code, 409);
  reset('In Service');
  assert.equal((await update({ status: 'Cancelled' })).code, 409);
  reset('Pending');
  appointment.assignedTechnician = id;
  const start = response();
  await convertAdminAppointmentToJob({ params: { appointmentId: id }, user: { _id: id, role: 'Technician' }, body: {} }, start);
  assert.equal(start.code, 409, 'Technician cannot start an unconfirmed appointment');
});
