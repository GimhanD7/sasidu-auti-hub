import { test } from 'node:test';
import assert from 'node:assert/strict';
import Appointment from '../models/Appointment.js';
import ServiceJob from '../models/ServiceJob.js';
import User from '../models/User.js';
import { technicianAssignmentConflict } from '../utils/technicianAvailability.js';
import { updateAdminJobTechnician } from '../controllers/adminAllocationController.js';

const id = '507f1f77bcf86cd799439011';
test('active work blocks assignments even when technician is marked Available', async t => {
  t.mock.method(ServiceJob, 'findOne', async () => ({ _id: id, technicianAssignments: [], save() { assert.fail('Blocked assignment must not save'); } }));
  t.mock.method(User, 'findOne', () => ({ select: async () => ({ _id: id, availabilityStatus: 'Available' }) }));
  t.mock.method(ServiceJob, 'exists', async filter => { assert.ok(filter.status.$in.includes('In Progress')); assert.equal(filter._id.$ne, id); return true; });
  const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await updateAdminJobTechnician({ params: { jobId: id }, body: { technicianId: id } }, res);
  assert.equal(res.code, 409);
  assert.match(res.data.message, /job in progress/);
});

test('same-time bookings conflict; other times and completed work remain available', async t => {
  t.mock.method(ServiceJob, 'exists', async filter => {
    assert.ok(!filter.status.$in.includes('Ready'));
    assert.equal(filter.appointment.$ne, id);
    return false;
  });
  t.mock.method(Appointment, 'exists', async filter => {
    assert.equal(filter._id.$ne, id);
    assert.ok(!filter.status.$in.includes('Cancelled'));
    assert.ok(!filter.status.$in.includes('Completed'));
    assert.equal(filter.preferredDate.$gte.toISOString(), '2026-10-13T00:00:00.000Z');
    return filter.preferredTime === '18:02';
  });
  const options = { appointmentId: id, preferredDate: new Date('2026-10-13'), preferredTime: '18:02' };
  assert.match(await technicianAssignmentConflict(id, options), /another appointment/);
  assert.equal(await technicianAssignmentConflict(id, { ...options, preferredTime: '19:00' }), '');
});
