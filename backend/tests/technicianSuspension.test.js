import { test } from 'node:test';
import assert from 'node:assert/strict';
import User from '../models/User.js';
import { setAdminTechnicianStatus } from '../controllers/adminTechnicianController.js';

const id = '507f1f77bcf86cd799439011';
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, set() { return this; }, json(data) { this.data = data; return this; } });

test('technician suspension and reactivation revoke sessions and are scoped to technicians', async t => {
  t.mock.method(User, 'findOneAndUpdate', async (filter, update) => {
    assert.deepEqual(filter, { _id: id, role: 'Technician' });
    assert.equal(update.$inc.sessionVersion, 1);
    assert.deepEqual(update.$unset, { resetTokenHash: '', resetTokenExpiresAt: '' });
    return { isActive: update.$set.isActive };
  });
  for (const isActive of [false, true]) {
    const res = response();
    await setAdminTechnicianStatus({ params: { technicianId: id }, body: { isActive } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.data.isActive, isActive);
    assert.match(res.data.message, isActive ? /reactivated/ : /suspended/);
  }
});

test('technician status rejects invalid inputs and missing technicians', async t => {
  t.mock.method(User, 'findOneAndUpdate', async () => null);
  for (const [technicianId, body, expected] of [['invalid', { isActive: false }, 400], [id, { isActive: 'false' }, 400], [id, { isActive: false }, 404]]) {
    const res = response();
    await setAdminTechnicianStatus({ params: { technicianId }, body }, res);
    assert.equal(res.code, expected);
  }
});
