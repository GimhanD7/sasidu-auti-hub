// Regression tests for the behaviors named in each test; assertions document expected results and rejected inputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import ServiceType from '../models/ServiceType.js';
import { changeTechnicianPassword } from '../controllers/authController.js';
import { setAdminCustomerStatus, createAdminCustomer } from '../controllers/adminCustomerController.js';
import { activateAdminServiceType, deleteAdminServiceType } from '../controllers/adminServiceTypeController.js';
import { passwordResetEmail } from '../services/passwordResetEmail.js';
import { validVehicleImage, MAX_IMAGE_BYTES } from '../utils/vehicleImage.js';
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, set() { return this; }, clearCookie() { return this; }, json(body) { this.body = body; return this; } });

test('vehicle image validation accepts JPG/PNG and rejects unsafe or oversized content', () => {
  assert.ok(validVehicleImage('https://example.com/car.jpg'));
  assert.ok(validVehicleImage('data:image/png;base64,iVBORw0KGgo='));
  assert.ok(validVehicleImage('data:image/jpeg;base64,/9j/'));
  for (const value of ['http://example.com/car.jpg', 'https://user:pass@example.com/a', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,aGVsbG8=', `data:image/png;base64,${Buffer.alloc(MAX_IMAGE_BYTES + 1).toString('base64')}`]) assert.equal(validVehicleImage(value), false);
});

test('customers can change passwords only with correct credentials and sessions are revoked', async t => {
  const user = { _id: 'customer', role: 'Customer', isActive: true, password: await bcrypt.hash('12345678', 4), sessionVersion: 0, async save() {} };
  t.mock.method(User, 'findById', () => ({ select: async () => user }));
  let revoked = false;
  t.mock.method(AuthSession, 'deleteMany', async () => { revoked = true; });
  const req = { user, body: { currentPassword: 'wrong', newPassword: 'new-password', confirmPassword: 'new-password' } };
  const bad = response(); await changeTechnicianPassword(req, bad); assert.equal(bad.code, 400); assert.equal(revoked, false);
  req.body.currentPassword = '12345678';
  const good = response(); await changeTechnicianPassword(req, good);
  assert.equal(good.code, 200); assert.ok(await bcrypt.compare('new-password', user.password)); assert.equal(user.sessionVersion, 1); assert.equal(revoked, true);
});

test('customer suspension and reactivation are scoped to customers and invalidate sessions', async t => {
  t.mock.method(User, 'findOneAndUpdate', async (filter, update) => {
    assert.deepEqual(filter.role.$in, ['Customer', 'user']); assert.equal(update.$inc.sessionVersion, 1);
    return { isActive: update.$set.isActive };
  });
  for (const isActive of [false, true]) {
    const res = response(); await setAdminCustomerStatus({ params: { customerId: '507f1f77bcf86cd799439011' }, body: { isActive } }, res);
    assert.equal(res.code, 200); assert.equal(res.body.isActive, isActive);
  }
});

test('admin customer creation hashes the requested default password', async t => {
  t.mock.method(User, 'exists', async () => false);
  t.mock.method(passwordResetEmail, 'isConfigured', () => false);
  t.mock.method(User, 'create', async data => { assert.ok(await bcrypt.compare('12345678', data.password)); assert.equal(data.role, 'Customer'); return { _id: 'customer', ...data }; });
  const res = response(); await createAdminCustomer({ body: { name: 'New Customer', email: 'new@example.com', mobile: '0771234567' } }, res); assert.equal(res.code, 201);
});

test('deleting service types hides bookings without deleting historical records', async t => {
  t.mock.method(ServiceType, 'findOneAndUpdate', async (filter, update) => { assert.deepEqual(update, { isActive: false, isDeleted: true }); return { _id: filter._id }; });
  const res = response(); await deleteAdminServiceType({ params: { serviceTypeId: '507f1f77bcf86cd799439011' } }, res); assert.equal(res.code, 200);
});

test('admin can reactivate a service type that has not been deleted', async t => {
  t.mock.method(ServiceType, 'exists', async () => true);
  t.mock.method(ServiceType, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(filter, { _id: '507f1f77bcf86cd799439011', isDeleted: { $ne: true } });
    assert.deepEqual(update, { isActive: true });
    assert.equal(options.new, true);
    return { _id: filter._id, isActive: true };
  });
  const res = response();
  await activateAdminServiceType({ params: { serviceTypeId: '507f1f77bcf86cd799439011' } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.serviceType, { id: '507f1f77bcf86cd799439011', isActive: true });
});
