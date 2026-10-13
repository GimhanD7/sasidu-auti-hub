import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/lib/api.js';
import { mutationToastMessage } from '../src/lib/mutationToast.js';

test('toasts describe customer bookings, admin changes and technician work accurately', () => {
  const cases = [
    ['post', '/appointments', {}, 'Awaiting admin confirmation'],
    ['patch', '/appointments/123/cancel', {}, 'cancelled'],
    ['post', '/appointments/123/cancellation-request', {}, 'stays active'],
    ['post', '/appointments/123/reschedule-request', {}, 'workshop review'],
    ['post', '/vehicles', {}, 'added'],
    ['patch', '/vehicles/123', {}, 'updated'],
    ['delete', '/vehicles/123', {}, 'deleted'],
    ['patch', '/admin/appointments/123', { status: 'Cancelled' }, 'cancelled'],
    ['patch', '/admin/appointments/123', { status: 'Confirmed' }, 'confirmed'],
    ['patch', '/admin/jobs/123/technician', { technicianId: '' }, 'removed'],
    ['patch', '/admin/invoices/123', { finalize: true }, 'finalized'],
    ['post', '/auth/technician/appointments/123/start', {}, 'started'],
    ['patch', '/auth/technician/jobs/123/card', { action: 'partAdd' }, 'Part added'],
    ['patch', '/auth/technician/jobs/123/card', { action: 'partRemove' }, 'Part removed'],
    ['patch', '/auth/technician/jobs/123/card', { action: 'completeJob' }, 'completed'],
  ];
  for (const [method, url, data, expected] of cases) {
    assert.ok(mutationToastMessage({ method, url, data: JSON.stringify(data) }).includes(expected), url);
  }
  for (const resource of ['customers', 'technicians', 'vehicles', 'service-types', 'invoices']) {
    for (const [method, expected] of [['post', 'created'], ['patch', 'updated'], ['delete', 'deleted']]) {
      assert.ok(mutationToastMessage({ method, url: `/admin/${resource}/123` }).includes(expected));
    }
  }
  assert.equal(mutationToastMessage({ method: 'patch', url: '/admin/invoices/123' }, { message: 'Draft saved. Email delivery failed.' }), 'Draft saved. Email delivery failed.');
  assert.equal(mutationToastMessage({ method: 'get', url: '/vehicles' }), null);
  assert.equal(mutationToastMessage({ method: 'post', url: '/auth/login' }), null);
  assert.equal(mutationToastMessage({ method: 'post', url: '/auth/logout' }), null);
});

test('shared client emits one toast per successful mutation, errors on failure, and none for reads', async () => {
  const originalWindow = globalThis.window;
  const events = [];
  globalThis.window = { dispatchEvent(event) { events.push(event.detail); } };
  const adapter = async config => ({ config, data: {}, status: 200, statusText: 'OK', headers: {} });
  try {
    await api.post('/vehicles', { make: 'Toyota' }, { adapter });
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'success');
    await api.get('/vehicles', { adapter });
    assert.equal(events.length, 1);
    await assert.rejects(api.delete('/vehicles/123', { adapter: async config => {
      const error = new Error('Conflict');
      error.config = config;
      error.response = { data: { message: 'Vehicle has repair records.' } };
      throw error;
    } }));
    assert.equal(events.length, 2);
    assert.equal(events[1].type, 'error');
    assert.equal(events[1].message, 'Vehicle has repair records.');
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
