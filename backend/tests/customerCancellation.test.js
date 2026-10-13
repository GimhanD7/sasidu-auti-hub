import { test } from 'node:test';
import assert from 'node:assert/strict';
import Appointment from '../models/Appointment.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { cancelCustomerAppointment, requestCustomerAppointmentCancellation } from '../controllers/customerAppointmentController.js';

const id = '507f1f77bcf86cd799439011';
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, set() { return this; }, json(data) { this.data = data; return this; } });
const request = { params: { appointmentId: id }, user: { _id: id } };

test('customers cancel only pending bookings and request cancellation after confirmation', async t => {
  let appointment;
  let saves;
  let notifications;
  const reset = status => {
    saves = 0;
    notifications = [];
    appointment = { _id: id, customer: id, status, preferredDate: new Date('2026-01-01'), preferredTime: '09:00', bookingSlotKey: '2026-01-01|09:00', history: [], async save() { saves++; }, toObject() { return this; } };
  };
  t.mock.method(Appointment, 'findOne', async query => {
    assert.equal(query.customer, id, 'Every action must be scoped to the logged-in customer');
    return appointment;
  });
  t.mock.method(User, 'find', () => ({ select() { return this; }, lean: async () => [{ _id: 'admin-id' }] }));
  t.mock.method(Notification, 'insertMany', async data => { notifications.push(...data); });
  const act = async handler => { const res = response(); await handler(request, res); return res; };

  reset('Pending');
  assert.equal((await act(cancelCustomerAppointment)).code, 200);
  assert.equal(appointment.status, 'Cancelled');
  assert.equal(saves, 1);
  for (const status of ['Confirmed', 'Checked In', 'In Service', 'Completed', 'Cancelled']) {
    reset(status);
    assert.equal((await act(cancelCustomerAppointment)).code, 409);
    assert.equal(appointment.status, status);
    assert.equal(saves, 0);
  }
  for (const status of ['Confirmed', 'Checked In']) {
    reset(status);
    const res = await act(requestCustomerAppointmentCancellation);
    assert.equal(res.code, 200);
    assert.equal(appointment.status, status);
    assert.equal(appointment.bookingSlotKey, '2026-01-01|09:00');
    assert.equal(res.data.appointment.cancellationRequest.status, 'Pending');
    assert.equal(appointment.history[0].action, 'Cancellation requested');
    assert.ok(notifications.some(item => item.user === 'admin-id' && item.link === '/admin/appointments' && item.type === 'AppointmentCancellationRequest'));
    assert.equal((await act(requestCustomerAppointmentCancellation)).code, 409);
    assert.equal(saves, 1);
  }
  for (const status of ['Pending', 'In Service', 'Completed', 'Cancelled']) {
    reset(status);
    assert.equal((await act(requestCustomerAppointmentCancellation)).code, 409);
    assert.equal(saves, 0);
  }
  appointment = null;
  assert.equal((await act(cancelCustomerAppointment)).code, 404);
  assert.equal((await act(requestCustomerAppointmentCancellation)).code, 404);
});

test('concurrent appointment changes return a conflict instead of cancelling a newly confirmed booking', async t => {
  assert.equal(Appointment.schema.options.optimisticConcurrency, true);
  t.mock.method(Appointment, 'findOne', async () => ({ status: 'Pending', history: [], async save() { throw { name: 'VersionError' }; } }));
  const res = response();
  await cancelCustomerAppointment(request, res);
  assert.equal(res.code, 409);
});
