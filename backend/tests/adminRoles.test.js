import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { createApp } from '../app.js';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import { hashToken } from '../utils/session.js';
import { createAdminTechnician } from '../controllers/adminTechnicianController.js';
import { passwordResetEmail } from '../services/passwordResetEmail.js';

test('new technicians receive the hashed default password', async t => {
  t.mock.method(User, 'exists', async () => false);
  t.mock.method(passwordResetEmail, 'isConfigured', () => false);
  t.mock.method(User, 'create', async data => {
    assert.equal(data.role, 'Technician');
    assert.notEqual(data.password, '12345678');
    assert.ok(await bcrypt.compare('12345678', data.password));
    return { _id: 'technician', ...data };
  });
  const res = { code: 200, status(code) { this.code = code; return this; }, set() { return this; }, json(data) { this.data = data; } };
  await createAdminTechnician({ body: { name: 'New Technician', email: 'tech@example.com', technicianSpecialization: 'Engine', workSchedule: { days: [1, 2], startTime: '09:00', endTime: '17:00' } } }, res);
  assert.equal(res.code, 201);
  assert.equal(res.data.technician.password, undefined);
});

test('only admins can change roles; changes invalidate sessions and preserve account data', async t => {
  const admin = { _id: '507f1f77bcf86cd799439011', name: 'Admin', role: 'Admin', sessionVersion: 0 };
  const customer = { _id: '507f1f77bcf86cd799439012', name: 'Customer', email: 'customer@example.com', role: 'Customer', sessionVersion: 0, password: 'existing hash', isActive: true };
  const tokens = ['a'.repeat(64), 'b'.repeat(64)];
  const users = [admin, customer];
  t.mock.method(AuthSession, 'findOne', async query => {
    const index = tokens.findIndex(token => hashToken(token) === query.tokenHash);
    return index < 0 ? null : { user: users[index]._id, version: 0 };
  });
  t.mock.method(User, 'findById', id => ({ select: async () => users.find(user => user._id === id) }));
  t.mock.method(User, 'findOneAndUpdate', (filter, update) => ({ select: async () => {
    const user = users.find(user => user._id === filter._id);
    if (!user) return null;
    assert.deepEqual(Object.keys(update.$set), ['role']);
    user.role = update.$set.role;
    user.sessionVersion += update.$inc.sessionVersion;
    return user;
  } }));
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(path, token, body) {
    return fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: body ? 'PATCH' : 'GET', headers: { ...(token ? { Cookie: `autoserv_session=${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  const path = `/api/admin/users/${customer._id}/role`;
  assert.equal((await request(path, null, { role: 'Admin' })).status, 401);
  assert.equal((await request('/api/admin/users', tokens[1])).status, 403);
  assert.equal((await request(path, tokens[1], { role: 'Admin' })).status, 403);
  assert.equal((await request(path, tokens[0], { role: 'Owner' })).status, 400);
  assert.equal((await request(`/api/admin/users/${admin._id}/role`, tokens[0], { role: 'Customer' })).status, 400);
  assert.equal((await request('/api/admin/users/507f1f77bcf86cd799439099/role', tokens[0], { role: 'Admin' })).status, 404);
  for (const role of ['Technician', 'Finance', 'Admin', 'Customer']) {
    const res = await request(path, tokens[0], { role });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.role, role);
    assert.equal(data.user.password, undefined);
    assert.equal(customer.password, 'existing hash');
    assert.equal(customer.isActive, true);
    assert.equal((await request('/api/auth/me', tokens[1])).status, 401);
  }
  assert.equal(customer.sessionVersion, 4);
});
