import { test } from 'node:test';
import assert from 'node:assert/strict';
import ServiceJob from '../models/ServiceJob.js';
import Appointment from '../models/Appointment.js';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { convertAdminAppointmentToJob } from '../controllers/adminAppointmentController.js';
import { updateTechnicianJobCard } from '../controllers/technicianJobCardController.js';
import { updateDraftInvoice } from '../controllers/financeInvoiceController.js';
import { submitCustomerPayment } from '../controllers/customerPaymentController.js';
import { reviewFinancePayment } from '../controllers/financePaymentController.js';
const id = n => `507f1f77bcf86cd7994390${String(n).padStart(2, '0')}`;
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, set() { return this; }, json(body) { this.body = body; return this; } });

test('confirmed appointment starts directly, completes without testing, and is paid only after verification', async t => {
  const technician = { _id: id(1), role: 'Technician', name: 'Technician' };
  const customer = { _id: id(2) };
  const appointment = { _id: id(3), assignedTechnician: technician._id, customer: customer._id, vehicle: id(4), status: 'Confirmed', problemDescription: 'Oil service', history: [], async save() {} };
  let job;
  let invoice;
  const payments = [];
  t.mock.method(Appointment, 'findById', async () => appointment);
  t.mock.method(Appointment, 'updateOne', async (filter, update) => { Object.assign(appointment, update.$set); return { modifiedCount: 1 }; });
  t.mock.method(ServiceJob, 'findOne', async query => query.technician && query.technician !== technician._id ? null : job || null);
  t.mock.method(ServiceJob, 'create', async data => (job = { ...data, _id: id(5), serviceNumber: 'JOB-SIMPLE', tasks: [], additionalRepairs: [], replacedParts: [], labourEntries: [], repairNotes: [], $locals: {}, async save() {} }));
  t.mock.method(User, 'find', () => ({ select() { return this; }, lean: async () => [] }));
  t.mock.method(Notification, 'create', async data => data);
  t.mock.method(Notification, 'insertMany', async data => data);
  t.mock.method(Invoice, 'findOne', async query => {
    if (!invoice) return null;
    if (typeof query.paymentStatus === 'string' && query.paymentStatus !== invoice.paymentStatus) return null;
    if (query.paymentStatus?.$in && !query.paymentStatus.$in.includes(invoice.paymentStatus)) return null;
    return invoice;
  });
  t.mock.method(Invoice, 'create', async data => (invoice = { ...data, _id: id(6), amountPaid: 0, async save() {} }));
  t.mock.method(Invoice, 'updateOne', async (query, update) => { Object.assign(invoice, update.$set); return { modifiedCount: 1 }; });
  t.mock.method(Payment, 'exists', async () => payments.some(payment => payment.status === 'Pending Verification'));
  t.mock.method(Payment, 'aggregate', async () => [{ amount: payments.filter(payment => payment.status === 'Completed').reduce((sum, payment) => sum + payment.amount, 0) }]);
  t.mock.method(Payment, 'create', async data => { const payment = { ...data, _id: id(10 + payments.length), status: 'Pending Verification' }; payments.push(payment); return payment; });
  t.mock.method(Payment, 'findOne', async query => { const payment = payments.find(payment => payment._id === query._id && payment.status === query.status); return payment ? { ...payment } : null; });
  t.mock.method(Payment, 'findOneAndUpdate', async (query, update) => { const payment = payments.find(payment => payment._id === query._id && payment.status === query.status); if (!payment) return null; Object.assign(payment, update.$set); return payment; });
  const start = response();
  await convertAdminAppointmentToJob({ params: { appointmentId: appointment._id }, user: technician, body: {} }, start);
  assert.equal(start.code, 201); assert.equal(job.status, 'In Progress'); assert.equal(appointment.status, 'In Service');
  for (const body of [{ action: 'partAdd', name: 'Oil filter', quantity: 2, unitCost: 500 }, { action: 'labourAdd', description: 'Oil service', hours: 1, ratePerHour: 1000 }]) {
    const res = response(); await updateTechnicianJobCard({ params: { jobId: job._id }, user: technician, body }, res); assert.equal(res.code, 200);
  }
  const incomplete = response(); await updateTechnicianJobCard({ params: { jobId: job._id }, user: technician, body: { action: 'completeJob', reportNotes: '' } }, incomplete); assert.equal(incomplete.code, 400);
  const complete = response();
  await updateTechnicianJobCard({ params: { jobId: job._id }, user: technician, body: { action: 'completeJob', reportNotes: 'Oil and filter replaced.' } }, complete);
  assert.equal(complete.code, 200); assert.equal(job.status, 'Ready'); assert.equal(appointment.status, 'Completed'); assert.equal(invoice.paymentStatus, 'Draft'); assert.equal(invoice.totalAmount, 2000);
  const edit = response(); await updateTechnicianJobCard({ params: { jobId: job._id }, user: technician, body: { action: 'partAdd', name: 'Extra', quantity: 1, unitCost: 50 } }, edit); assert.equal(edit.code, 409);
  const paymentBody = { invoiceId: invoice._id, method: 'Bank Transfer', transactionReference: 'BANK-001' };
  const beforeIssue = response(); await submitCustomerPayment({ user: customer, body: paymentBody }, beforeIssue); assert.equal(beforeIssue.code, 404);
  const issue = response(); await updateDraftInvoice({ params: { invoiceId: invoice._id }, body: { finalize: true } }, issue); assert.equal(issue.code, 200); assert.equal(invoice.paymentStatus, 'Pending');
  const submit = response(); await submitCustomerPayment({ user: customer, body: paymentBody }, submit); assert.equal(submit.code, 201); assert.equal(payments[0].status, 'Pending Verification'); assert.equal(invoice.amountPaid, 0);
  const duplicate = response(); await submitCustomerPayment({ user: customer, body: paymentBody }, duplicate); assert.equal(duplicate.code, 409);
  const failed = response(); await reviewFinancePayment({ params: { paymentId: payments[0]._id }, user: { _id: id(7) }, body: { decision: 'Failed', failureReason: 'Reference not found' } }, failed); assert.equal(failed.code, 200); assert.equal(invoice.paymentStatus, 'Pending');
  const retry = response(); await submitCustomerPayment({ user: customer, body: { ...paymentBody, transactionReference: 'BANK-002' } }, retry); assert.equal(retry.code, 201);
  const paid = response(); await reviewFinancePayment({ params: { paymentId: payments[1]._id }, user: { _id: id(7) }, body: { decision: 'Completed' } }, paid); assert.equal(paid.code, 200); assert.equal(invoice.paymentStatus, 'Paid'); assert.equal(invoice.amountPaid, 2000);
});

test('technician can add direct service charge without parts and complete job with accurate balance', async t => {
  const technician = { _id: id(21), role: 'Technician', name: 'Technician 2' };
  const customer = { _id: id(22) };
  let job = {
    _id: id(23),
    serviceNumber: 'JOB-DIRECT',
    technician: technician._id,
    customer: customer._id,
    status: 'In Progress',
    tasks: [],
    additionalRepairs: [],
    replacedParts: [],
    labourEntries: [],
    repairNotes: [],
    timeline: [],
    $locals: {},
    async save() {}
  };
  job.labourEntries.id = idVal => job.labourEntries.find(entry => entry._id === idVal);
  job.labourEntries.pull = idVal => { job.labourEntries = job.labourEntries.filter(entry => entry._id !== idVal); };
  let invoice = null;

  t.mock.method(ServiceJob, 'findOne', async () => job);
  t.mock.method(Invoice, 'findOne', async () => invoice);
  t.mock.method(Invoice, 'create', async data => (invoice = { ...data, _id: id(24), amountPaid: 0, async save() {} }));
  t.mock.method(Appointment, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(User, 'find', () => ({ select() { return this; }, lean: async () => [] }));

  // Add direct service charge amount (no parts)
  const addServiceCharge = response();
  await updateTechnicianJobCard({
    params: { jobId: job._id },
    user: technician,
    body: { action: 'labourAdd', description: 'Periodic General Service', amount: 3500 }
  }, addServiceCharge);

  assert.equal(addServiceCharge.code, 200);
  assert.equal(job.labourEntries.length, 1);
  assert.equal(job.labourEntries[0].ratePerHour, 3500);
  assert.equal(job.labourEntries[0].minutes, 60);

  // Complete job and verify invoice total matches 3500 without adding any parts
  const complete = response();
  await updateTechnicianJobCard({
    params: { jobId: job._id },
    user: technician,
    body: { action: 'completeJob', reportNotes: 'Periodic maintenance inspection and service done.' }
  }, complete);

  assert.equal(complete.code, 200);
  assert.equal(job.status, 'Ready');
  assert.ok(invoice);
  assert.equal(invoice.partsCost, 0);
  assert.equal(invoice.labourCost, 3500);
  assert.equal(invoice.totalAmount, 3500);
});

