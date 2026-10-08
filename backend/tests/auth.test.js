import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { createApp } from '../app.js';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import { passwordResetEmail } from '../services/passwordResetEmail.js';
import { hashToken } from '../utils/session.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

test('auth HTTP flow: credentials, cookies, access, logout and one-time password reset', async t => {
  const customer = { _id: 'customer', name: 'Test Customer', email: 'customer@example.com', mobile: '+94771234567', password: await bcrypt.hash('old-password', 10), role: 'user', isActive: true, sessionVersion: 0 };
  const users = [customer];
  const sessions = [];
  let sentEmail;
  t.mock.method(User, 'findOne', async query => users.find(user => (!query.email || user.email === query.email) && (!query.mobile || user.mobile === query.mobile) && (!query.isActive || user.isActive !== false)) || null);
  t.mock.method(User, 'findById', id => ({ select: async () => users.find(user => user._id === id) || null }));
  t.mock.method(User, 'updateOne', async (query, update) => {
    const user = users.find(user => user._id === query._id && (!query.resetTokenHash || user.resetTokenHash === query.resetTokenHash));
    if (user) {
      Object.assign(user, update.$set || {});
      for (const key of Object.keys(update.$unset || {})) delete user[key];
    }
    return { modifiedCount: user ? 1 : 0 };
  });
  t.mock.method(User, 'findOneAndUpdate', async (query, update) => {
    const user = users.find(user => user.resetTokenHash === query.resetTokenHash && user.resetTokenExpiresAt > query.resetTokenExpiresAt.$gt && user.isActive !== false);
    if (!user) return null;
    Object.assign(user, update.$set);
    user.sessionVersion += update.$inc.sessionVersion;
    for (const key of Object.keys(update.$unset)) delete user[key];
    return user;
  });
  t.mock.method(AuthSession, 'create', async data => { sessions.push(data); return data; });
  t.mock.method(AuthSession, 'findOne', async query => sessions.find(session => session.tokenHash === query.tokenHash && session.expiresAt > query.expiresAt.$gt) || null);
  t.mock.method(AuthSession, 'deleteOne', async query => {
    const index = sessions.findIndex(session => session.tokenHash === query.tokenHash);
    if (index !== -1) sessions.splice(index, 1);
  });
  t.mock.method(passwordResetEmail, 'isConfigured', () => true);
  t.mock.method(passwordResetEmail, 'send', async (email, token) => { sentEmail = { email, token }; });
  const app = createApp();
  app.get('/test/admin', requireAuth, requireRole('Admin'), (req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { body, cookie, origin } = {}) {
    const response = await fetch(url + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  try {
    assert.equal((await request('/api/auth/me')).response.status, 401);
    assert.equal((await request('/api/auth/login', { body: { email: {} } })).response.status, 400);
    assert.equal((await request('/api/auth/login', { body: { email: customer.email, password: 'wrong' } })).response.status, 401);
    assert.equal((await request('/api/auth/login', { origin: 'https://other.example', body: { email: customer.email, password: 'old-password' } })).response.status, 403);
    const login = await request('/api/auth/login', { origin: 'http://localhost:5173', body: { email: ' CUSTOMER@example.com ', password: 'old-password', remember: true } });
    assert.equal(login.response.status, 200);
    assert.equal(login.data.role, 'Customer');
    assert.equal(login.data.password, undefined);
    assert.equal(login.data.token, undefined);
    assert.match(login.response.headers.get('set-cookie'), /HttpOnly/);
    assert.match(login.response.headers.get('set-cookie'), /SameSite=Lax/);
    assert.match(login.response.headers.get('set-cookie'), /Max-Age=2592000/);
    assert.equal(login.response.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(login.response.headers.get('cache-control'), 'no-store');
    assert.equal(sessions[0].tokenHash, hashToken(login.cookie.split('=')[1]));
    assert.equal((await request('/api/auth/me', { cookie: login.cookie })).data.fullName, customer.name);
    assert.equal((await request('/test/admin', { cookie: login.cookie })).response.status, 403);

    customer.isActive = false;
    assert.equal((await request('/api/auth/me', { cookie: login.cookie })).response.status, 401);
    assert.equal((await request('/api/auth/login', { body: { email: customer.email, password: 'old-password' } })).response.status, 401);
    customer.isActive = true;
    sessions[0].expiresAt = new Date(Date.now() - 1000);
    assert.equal((await request('/api/auth/me', { cookie: login.cookie })).response.status, 401);
    sessions[0].expiresAt = new Date(Date.now() + 60000);
    const logout = await request('/api/auth/logout', { cookie: login.cookie, body: {} });
    assert.equal(logout.response.status, 200);
    assert.match(logout.response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
    assert.equal((await request('/api/auth/me', { cookie: login.cookie })).response.status, 401);
    assert.equal((await request('/api/auth/logout', { body: {} })).response.status, 200);

    const mobileLogin = await request('/api/auth/login', { body: { email: '+94 (77) 123-4567', password: 'old-password' } });
    assert.equal(mobileLogin.response.status, 200);
    assert.doesNotMatch(mobileLogin.response.headers.get('set-cookie'), /Max-Age/);
    const known = await request('/api/auth/forgot-password', { body: { email: ' CUSTOMER@example.com ' } });
    const unknown = await request('/api/auth/forgot-password', { body: { email: 'unknown@example.com' } });
    assert.deepEqual(known.data, unknown.data);
    assert.equal(sentEmail.email, customer.email);
    assert.equal(customer.resetTokenHash, hashToken(sentEmail.token));
    assert.notEqual(customer.resetTokenHash, sentEmail.token);
    assert.ok(customer.resetTokenExpiresAt > new Date());
    assert.equal(known.data.token, undefined);
    assert.equal((await request('/api/auth/reset-password', { body: { token: sentEmail.token, password: 'new-password', confirmPassword: 'different' } })).response.status, 400);
    customer.resetTokenExpiresAt = new Date(Date.now() - 1000);
    assert.equal((await request('/api/auth/reset-password', { body: { token: sentEmail.token, password: 'new-password', confirmPassword: 'new-password' } })).response.status, 400);
    customer.resetTokenExpiresAt = new Date(Date.now() + 60000);
    const resetBody = { token: sentEmail.token, password: 'new-password', confirmPassword: 'new-password' };
    assert.equal((await request('/api/auth/reset-password', { body: resetBody })).response.status, 200);
    assert.equal(await bcrypt.compare('new-password', customer.password), true);
    assert.equal((await request('/api/auth/reset-password', { body: resetBody })).response.status, 400);
    assert.equal((await request('/api/auth/me', { cookie: mobileLogin.cookie })).response.status, 401);
    assert.equal((await request('/api/auth/login', { body: { email: customer.email, password: 'old-password' } })).response.status, 401);
    assert.equal((await request('/api/auth/login', { body: { email: customer.email, password: 'new-password' } })).response.status, 200);
    assert.equal(customer.resetTokenHash, undefined);

    passwordResetEmail.isConfigured = () => false;
    assert.equal((await request('/api/auth/forgot-password', { body: { email: customer.email } })).response.status, 503);
    assert.equal((await request('/api/auth/forgot-password', { body: { email: 'unknown@example.com' } })).response.status, 503);
    for (let i = 0; i < 5; i++) await request('/api/auth/forgot-password', { body: { email: 'unknown@example.com' } });
    assert.equal((await request('/api/auth/forgot-password', { body: { email: 'unknown@example.com' } })).response.status, 429);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
