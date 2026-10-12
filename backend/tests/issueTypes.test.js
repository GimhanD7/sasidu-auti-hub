import test from 'node:test';
import assert from 'node:assert/strict';
import { ISSUE_TYPES, inferIssueType } from '../utils/issueTypes.js';

test('service issue categories cover workshop issues and map service catalog labels', () => {
  assert.deepEqual(ISSUE_TYPES, [
    'Maintenance', 'Engine', 'Transmission', 'Brakes', 'Electrical', 'Suspension',
    'Cooling', 'Exhaust', 'Tyres', 'Body', 'Other',
  ]);
  assert.equal(inferIssueType('Brake Service', 'Brake Systems'), 'Brakes');
  assert.equal(inferIssueType('Engine Diagnosis', 'Engine Diagnostics'), 'Engine');
  assert.equal(inferIssueType('Oil Change', 'General Maintenance'), 'Maintenance');
  assert.equal(inferIssueType('General Repair', 'General Repair'), 'Other');
});
