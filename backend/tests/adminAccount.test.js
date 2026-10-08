import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { createAdminAccount, resetAdminAccountPassword } from '../controllers/adminAccountController.js';

function response() {
  return {
    statusCode: 200, body: null, headers: {},
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('admin creates an admin account with a hashed password and creator attribution', async t => {
  let created;
  t.mock.method(User, 'exists', async () => false);
  t.mock.method(User, 'create', async data => { created = { ...data, _id: 'new-admin', isActive: true, createdAt: new Date() }; return created; });
  const res = response();
  await createAdminAccount({ user: { _id: 'admin-1' }, body: { name: 'New Admin', email: 'NEW@example.com', mobile: '+94771234567', password: 'secure-pass-1', confirmPassword: 'secure-pass-1' } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(created.role, 'Admin');
  assert.equal(created.email, 'new@example.com');
  assert.equal(created.createdBy, 'admin-1');
  assert.equal(await bcrypt.compare('secure-pass-1', created.password), true);
  assert.equal(res.body.account.password, undefined);
});

test('admin creation rejects mismatched or duplicate credentials', async t => {
  t.mock.method(User, 'exists', async () => true);
  const mismatch = response();
  await createAdminAccount({ user: { _id: 'admin-1' }, body: { name: 'Another Admin', email: 'a@example.com', password: 'secure-pass-1', confirmPassword: 'different-pass' } }, mismatch);
  assert.equal(mismatch.statusCode, 400);
  const duplicate = response();
  await createAdminAccount({ user: { _id: 'admin-1' }, body: { name: 'Another Admin', email: 'a@example.com', password: 'secure-pass-1', confirmPassword: 'secure-pass-1' } }, duplicate);
  assert.equal(duplicate.statusCode, 409);
});

test('admin password reset hashes the new password and invalidates old sessions', async t => {
  const account = {
    _id: '64f000000000000000000001', name: 'Target User', password: 'old-hash', sessionVersion: 4,
    resetTokenHash: 'one-time-token', resetTokenExpiresAt: new Date(),
    async save() { this.saved = true; },
  };
  t.mock.method(User, 'findById', () => ({ select: async () => account }));
  const res = response();
  await resetAdminAccountPassword({ params: { accountId: account._id }, user: { _id: 'admin-1' }, body: { password: 'new-secure-pass', confirmPassword: 'new-secure-pass' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(account.sessionVersion, 5);
  assert.equal(account.resetTokenHash, undefined);
  assert.equal(account.resetTokenExpiresAt, undefined);
  assert.equal(account.passwordChangedBy, 'admin-1');
  assert.equal(account.saved, true);
  assert.equal(await bcrypt.compare('new-secure-pass', account.password), true);
});

test('admin cannot use the other-account password reset action on their own account', async () => {
  const res = response();
  await resetAdminAccountPassword({ params: { accountId: '64f000000000000000000001' }, user: { _id: '64f000000000000000000001' }, body: { password: 'new-secure-pass', confirmPassword: 'new-secure-pass' } }, res);
  assert.equal(res.statusCode, 400);
});
