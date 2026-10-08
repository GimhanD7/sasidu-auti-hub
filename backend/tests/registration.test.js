import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { registerUser } from '../controllers/authController.js';
import { validateRegistration } from '../utils/registration.js';

const valid = { fullName: ' Test Customer ', email: ' TEST@example.com ', mobile: '+94 (77) 123-4567', password: 'test-password', confirmPassword: 'test-password' };

test('normalizes customer details and rejects invalid registration data', () => {
  assert.deepEqual(validateRegistration(valid).data, { name: 'Test Customer', email: 'test@example.com', mobile: '+94771234567', password: 'test-password' });
  for (const body of [undefined, null, {}, { ...valid, fullName: ' ' }, { ...valid, email: 'invalid' }, { ...valid, mobile: 'abc1234567890' }, { ...valid, password: 'short' }, { ...valid, confirmPassword: 'different' }, { ...valid, password: '😀'.repeat(20), confirmPassword: '😀'.repeat(20) }, { ...valid, email: {} }]) {
    assert.ok(validateRegistration(body).error);
  }
});

test('registration hashes password, creates a Customer profile and handles duplicate races', async () => {
  const originalFind = User.findOne;
  const originalCreate = User.create;
  let created;
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    User.findOne = async () => null;
    User.create = async data => { created = data; return { ...data, _id: 'customer-id' }; };
    await registerUser({ body: { ...valid, role: 'Admin' } }, res);
    assert.equal(res.code, 201);
    assert.equal(created.role, 'Customer');
    assert.equal(await bcrypt.compare(valid.password, created.password), true);
    assert.equal(res.body.password, undefined);
    assert.equal(res.body.fullName, 'Test Customer');
    User.findOne = async () => ({ _id: 'existing' });
    await registerUser({ body: valid }, res);
    assert.equal(res.code, 409);
    User.findOne = async () => null;
    User.create = async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); };
    await registerUser({ body: valid }, res);
    assert.equal(res.code, 409);
    User.create = async () => { throw new Error('private database details'); };
    await registerUser({ body: valid }, res);
    assert.equal(res.code, 500);
    assert.equal(res.body.message.includes('private'), false);
    await registerUser({ body: {} }, res);
    assert.equal(res.code, 400);
  } finally {
    User.findOne = originalFind;
    User.create = originalCreate;
  }
});
