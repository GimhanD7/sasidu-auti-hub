import { test } from 'node:test';
import assert from 'node:assert/strict';
import ServiceJob from '../models/ServiceJob.js';
import Invoice from '../models/Invoice.js';
import { updateTechnicianJobCard } from '../controllers/technicianJobCardController.js';
import { updateDraftInvoice, saveJobInvoice } from '../controllers/financeInvoiceController.js';
import { jobTiming } from '../utils/jobTiming.js';
import { invoicePricing } from '../utils/invoicePricing.js';

const id = '507f1f77bcf86cd799439011';
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, set() { return this; }, json(data) { this.data = data; return this; } });
const parts = [{ name: 'Oil filter', partNumber: 'OF-1', quantity: 2, unitPrice: 0, total: 0 }];

test('saved job timestamps calculate elapsed hours independently of later updates', () => {
  const job = { startedAt: new Date('2026-10-13T03:00:00Z'), completedAt: new Date('2026-10-13T05:30:00Z'), updatedAt: new Date('2026-10-14') };
  assert.equal(jobTiming(job).durationHours, 2.5);
  assert.equal(jobTiming({ technicianAcceptedAt: job.startedAt, finalReport: { completedAt: job.completedAt } }).durationHours, 2.5);
  assert.equal(jobTiming({ completedAt: job.completedAt }).durationHours, null);
  assert.equal(jobTiming({ startedAt: job.completedAt, completedAt: job.startedAt }).durationHours, null);
});

test('pricing uses quantities and hours, ignores supplied totals, and rejects invalid prices', () => {
  const body = { parts: [{ ...parts[0], unitPrice: 250, total: 1 }], labourItems: [{ description: 'Labour', hours: 2.5, rate: 1000, total: 1 }] };
  const result = invoicePricing(body, { parts });
  assert.equal(result.partsCost, 500);
  assert.equal(result.labourCost, 2500);
  for (const price of [-1, 'abc', null, Infinity, 100000001, {}]) {
    assert.throws(() => invoicePricing({ parts: [{ ...parts[0], unitPrice: price }] }, { parts }));
    assert.throws(() => invoicePricing({ labourItems: [{ description: 'Labour', hours: 1, rate: price }] }, {}));
  }
  assert.throws(() => invoicePricing({ parts: [{ ...parts[0], quantity: 3, unitPrice: 250 }] }, { parts }));
});

test('technician prices are rejected even through direct requests, and acceptance stores the original start', async t => {
  const job = { status: 'In Progress', history: [], timeline: [], async save() {} };
  t.mock.method(ServiceJob, 'findOne', async () => job);
  const act = async body => {
    const res = response();
    await updateTechnicianJobCard({ params: { jobId: id }, user: { _id: id, name: 'Technician' }, body }, res);
    return res;
  };
  assert.equal((await act({ action: 'acceptJob' })).code, 200);
  const startedAt = job.startedAt;
  assert.ok(startedAt instanceof Date);
  assert.equal((await act({ action: 'acceptJob' })).code, 409);
  assert.equal(job.startedAt, startedAt);
  for (const body of [
    { action: 'partAdd', name: 'Filter', quantity: 1, unitCost: 100 },
    { action: 'labourAdd', description: 'Service', amount: 500 },
    { action: 'labourTimerStart', ratePerHour: 500 },
  ]) assert.equal((await act(body)).code, 403);
});

test('admin prices only completed work and recalculates discounts and tax before saving', async t => {
  let ready = false;
  let saves = 0;
  const invoice = { _id: id, serviceJob: id, parts, partsCost: 0, labourCost: 0, paymentStatus: 'Draft', async save() { saves++; } };
  t.mock.method(Invoice, 'findOne', async () => invoice);
  t.mock.method(ServiceJob, 'findOne', async filter => { assert.equal(filter.status, 'Ready'); return ready ? { status: 'Ready' } : null; });
  const body = { parts: [{ ...parts[0], unitPrice: 250 }], labourItems: [{ description: 'Labour', hours: 2.5, rate: 1000 }], adminChargeAmount: 1000, discountRate: 10, taxRate: 10 };
  const act = async () => { const res = response(); await updateDraftInvoice({ params: { invoiceId: id }, body }, res); return res; };
  assert.equal((await act()).code, 409);
  assert.equal(saves, 0);
  ready = true;
  const res = await act();
  assert.equal(res.code, 200);
  assert.equal(invoice.partsCost, 500);
  assert.equal(invoice.labourCost, 2500);
  assert.equal(invoice.discount, 400);
  assert.equal(invoice.tax, 360);
  assert.equal(invoice.totalAmount, 3960);
  assert.equal(res.data.invoice.parts[0].unitPrice, 250);
  assert.equal(saves, 1);
});

test('saving a job invoice preserves admin prices already saved on its draft', async t => {
  const job = { _id: id, status: 'Ready', replacedParts: [{ name: 'Filter', quantity: 2 }], labourEntries: [] };
  const invoice = { _id: id, paymentStatus: 'Draft', parts: [{ ...parts[0], unitPrice: 250, total: 500 }], labourItems: [{ description: 'Labour', hours: 2, rate: 1000, total: 2000 }], partsCost: 500, labourCost: 2000, async save() {} };
  t.mock.method(ServiceJob, 'findOne', () => ({ populate: async () => job }));
  t.mock.method(Invoice, 'findOne', async () => invoice);
  const res = response();
  await saveJobInvoice({ params: { jobId: id }, body: {} }, res);
  assert.equal(res.code, 200);
  assert.equal(invoice.totalAmount, 2500);
  assert.equal(invoice.parts[0].unitPrice, 250);
});
