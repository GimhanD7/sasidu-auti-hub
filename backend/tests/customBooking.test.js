// Regression tests for the behaviors named in each test; assertions document expected results and rejected inputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Appointment from '../models/Appointment.js';
import Vehicle from '../models/Vehicle.js';
import ServiceType from '../models/ServiceType.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { createCustomerAppointment, getAppointmentAvailability, requestCustomerAppointmentReschedule } from '../controllers/customerAppointmentController.js';

const id = '507f1f77bcf86cd799439011';
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, set() { return this; }, json(data) { this.data = data; return this; } });
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

test('custom minute bookings and reschedules retain date, conflict and race validation', async t => {
  t.mock.method(ServiceType, 'exists', async () => true);
  t.mock.method(ServiceType, 'find', () => ({ sort() { return this; }, select() { return this; }, lean: async () => [{ name: 'Oil Change' }] }));
  t.mock.method(Vehicle, 'findOne', () => ({ select: async () => ({ _id: id, make: 'Toyota', model: 'Corolla' }) }));
  let conflict = false;
  let duplicate = false;
  t.mock.method(Appointment, 'exists', async query => { assert.equal(query.preferredTime, '10:37'); return conflict; });
  t.mock.method(Appointment, 'create', async data => { if (duplicate) throw { code: 11000 }; return data; });
  t.mock.method(Notification, 'create', async () => ({}));
  t.mock.method(User, 'find', () => ({ select() { return this; }, lean: async () => [] }));
  t.mock.method(Notification, 'insertMany', async () => []);
  const body = { vehicleId: id, serviceType: 'Oil Change', preferredDate: tomorrow(), preferredTime: '10:37', problemDescription: 'Oil service' };
  const create = async changes => { const res = response(); await createCustomerAppointment({ user: { _id: id }, body: { ...body, ...changes } }, res); return res; };
  assert.equal((await create()).code, 201);
  assert.equal((await create({ preferredTime: '25:37' })).code, 400);
  assert.equal((await create({ preferredDate: '2000-01-01' })).code, 400);
  conflict = true;
  assert.equal((await create()).code, 409);
  conflict = false;
  duplicate = true;
  assert.equal((await create()).code, 409);
  const appointment = { _id: id, preferredDate: new Date(tomorrow()), preferredTime: '09:00', status: 'Pending', history: [], async save() {}, toObject() { return this; } };
  t.mock.method(Appointment, 'findOne', async () => appointment);
  const res = response();
  await requestCustomerAppointmentReschedule({ params: { appointmentId: id }, user: { _id: id }, body }, res);
  assert.equal(res.code, 200);
  assert.equal(appointment.rescheduleRequest.preferredTime, '10:37');
});

test('availability reports booked custom times without default six slots', async t => {
  t.mock.method(Appointment, 'find', () => ({ select() { return this; }, lean: async () => [{ preferredDate: new Date(tomorrow()), preferredTime: '10:37' }] }));
  const res = response();
  await getAppointmentAvailability({ query: { from: tomorrow(), days: '1' }, user: { _id: id } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.data.dates[0].bookedTimes, ['10:37']);
  assert.equal(res.data.dates[0].slots, undefined);
  assert.equal(res.data.dates[0].available, true);
});
