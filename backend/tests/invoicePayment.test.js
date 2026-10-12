// Regression tests for the behaviors named in each test; assertions document expected results and rejected inputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Invoice from '../models/Invoice.js';
import ServiceJob from '../models/ServiceJob.js';
import User from '../models/User.js';
import { invoiceEmail } from '../services/invoiceEmail.js';
import { updateDraftInvoice, saveJobInvoice } from '../controllers/financeInvoiceController.js';
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, set() { return this; }, json(body) { this.body = body; } });

test('zero-total drafts cannot be issued but can still be saved', async t => {
  let saves = 0;
  const invoice = { _id: '507f1f77bcf86cd799439011', paymentStatus: 'Draft', partsCost: 0, labourCost: 0, async save() { saves++; } };
  t.mock.method(Invoice, 'findOne', async () => invoice);
  const res = response();
  await updateDraftInvoice({ params: { invoiceId: invoice._id }, body: { finalize: true } }, res);
  assert.equal(res.code, 400); assert.match(res.body.message, /charges/); assert.equal(invoice.paymentStatus, 'Draft'); assert.equal(saves, 0);
  const draft = response(); await updateDraftInvoice({ params: { invoiceId: invoice._id }, body: {} }, draft);
  assert.equal(draft.code, 200); assert.equal(saves, 1);
});

test('job billing cannot create a zero-total issued invoice', async t => {
  const job = { _id: '507f1f77bcf86cd799439011', replacedParts: [], labourEntries: [], additionalRepairs: [] };
  t.mock.method(ServiceJob, 'findOne', () => ({ populate: async () => job }));
  t.mock.method(Invoice, 'findOne', async () => null);
  const create = t.mock.method(Invoice, 'create', async () => { throw new Error('Should not create an invoice'); });
  const res = response(); await saveJobInvoice({ params: { jobId: job._id }, body: { finalize: true } }, res);
  assert.equal(res.code, 400); assert.match(res.body.message, /charges/); assert.equal(create.mock.callCount(), 0);
});

test('issuing a draft invoice emails the customer and returns the delivery state', async t => {
  const customer = { _id: 'customer-id', name: 'Workshop Customer', email: 'customer@example.com' };
  const invoice = { _id: '507f1f77bcf86cd799439012', customer: customer._id, invoiceNumber: 'INV-TEST-2', paymentStatus: 'Draft', partsCost: 1000, labourCost: 500, async save() {} };
  t.mock.method(Invoice, 'findOne', async () => invoice);
  t.mock.method(User, 'findById', () => ({ select: async () => customer }));
  t.mock.method(invoiceEmail, 'isConfigured', () => true);
  const send = t.mock.method(invoiceEmail, 'send', async () => {});
  const res = response();
  await updateDraftInvoice({ params: { invoiceId: invoice._id }, body: { finalize: true, taxRate: 0, discountRate: 0, adminChargeDescription: 'Additional labour', adminChargeAmount: 200 } }, res);
  assert.equal(res.code, 200);
  assert.equal(invoice.paymentStatus, 'Pending');
  assert.equal(invoice.totalAmount, 1700);
  assert.equal(invoice.adminChargeDescription, 'Additional labour');
  assert.equal(res.body.emailed, true);
  assert.match(res.body.message, /emailed/);
  assert.equal(send.mock.callCount(), 1);
});
