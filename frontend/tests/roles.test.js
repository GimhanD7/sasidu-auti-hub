// Regression tests for the behaviors named in each test; assertions document expected results and rejected inputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dashboardForRole } from '../src/auth/roles.js';

test('login redirects every supported role to its own dashboard', () => {
  for (const [role, target] of Object.entries({ Customer: '/customer/dashboard', user: '/customer/dashboard', Admin: '/admin/dashboard', admin: '/admin/dashboard', Technician: '/technician/dashboard' })) {
    assert.equal(dashboardForRole(role), target);
  }
  assert.equal(dashboardForRole(undefined), '/login');
  assert.equal(dashboardForRole('unknown'), '/login');
});
