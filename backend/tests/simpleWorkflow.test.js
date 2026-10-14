// Regression tests for the behaviors named in each test; assertions document expected results and rejected inputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ServiceJob from '../models/ServiceJob.js';
import Appointment from '../models/Appointment.js';
import Vehicle from '../models/Vehicle.js';
import { createCustomerAppointment } from '../controllers/customerAppointmentController.js';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { convertAdminAppointmentToJob, updateAdminAppointment } from '../controllers/adminAppointmentController.js';
import { updateTechnicianJobCard } from '../controllers/technicianJobCardController.js';
import { updateDraftInvoice } from '../controllers/financeInvoiceController.js';
import { submitCustomerPayment } from '../controllers/customerPaymentController.js';
import { reviewFinancePayment } from '../controllers/financePaymentController.js';
const id = n => `507f1f77bcf86cd7994390${String(n).padStart(2, '0')}`;
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, set() { return this; }, json(body) { this.body = body; return this; } });

test('custom customer booking is confirmed by admin, started and completed by technician, then paid only after admin verification', async t => {
  const technician = { _id: id(1), role: 'Technician', name: 'Technician' };
  const customer = { _id: id(2) };
  let appointment;
  let job;
  let invoice;
  const payments = [];
  t.mock.method(Appointment, 'findById', () => ({ select: async () => appointment, then: resolve => resolve(appointment) }));
  t.mock.method(Appointment, 'exists', async () => false);
  t.mock.method(ServiceJob, 'exists', async () => false);
  t.mock.method(Appointment, 'create', async data => (appointment = { ...data, _id: id(3), updatedAt: new Date(), async save() {} }));
  t.mock.method(Vehicle, 'findOne', () => ({ select: async () => ({ _id: id(4), make: 'Toyota', model: 'Prius' }) }));
  t.mock.method(User, 'findOne', () => ({ select: async () => ({ ...technician, availabilityStatus: 'Available' }) }));
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
  const booking = response();
  await createCustomerAppointment({ user: customer, body: { vehicleId: id(4), preferredDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), preferredTime: '10:37', serviceType: '  Custom full service  ', problemDescription: 'Oil service' } }, booking);
  assert.equal(booking.code, 201);
  assert.equal(appointment.status, 'Pending');
  assert.equal(appointment.serviceType, 'Custom full service');
  const adminStart = response();
  await convertAdminAppointmentToJob({ params: { appointmentId: appointment._id }, user: { _id: id(7), role: 'Admin' }, body: {} }, adminStart);
  assert.equal(adminStart.code, 403);
  const confirm = response();
  await updateAdminAppointment({ params: { appointmentId: appointment._id }, user: { _id: id(7), role: 'Admin' }, body: { technicianId: technician._id, serviceType: 'Full service with custom inspection', estimatedCost: 2000 } }, confirm);
  assert.equal(confirm.code, 200);
  assert.equal(appointment.status, 'Confirmed');
  assert.equal(job, undefined, 'Confirmation does not start a service job');
  const wrongTechnician = response();
  await convertAdminAppointmentToJob({ params: { appointmentId: appointment._id }, user: { _id: id(9), role: 'Technician' }, body: {} }, wrongTechnician);
  assert.equal(wrongTechnician.code, 403);
  const start = response();
  await convertAdminAppointmentToJob({ params: { appointmentId: appointment._id }, user: technician, body: {} }, start);
  assert.equal(start.code, 201); assert.equal(job.status, 'In Progress'); assert.equal(appointment.status, 'In Service');
  assert.equal(job.estimatedCost, 2000);
  assert.ok(job.technicianAcceptedAt, 'Starting service also accepts the assignment');
  assert.ok(job.startedAt, 'Starting service persists its start time');
  assert.equal(job.technicianAcceptedBy, technician._id);
  for (const body of [{ action: 'partAdd', name: 'Oil filter', quantity: 2 }, { action: 'labourAdd', description: 'Oil service', hours: 1 }]) {
    const res = response(); await updateTechnicianJobCard({ params: { jobId: job._id }, user: technician, body }, res); assert.equal(res.code, 200);
  }
  const incomplete = response(); await updateTechnicianJobCard({ params: { jobId: job._id }, user: technician, body: { action: 'completeJob', reportNotes: '' } }, incomplete); assert.equal(incomplete.code, 400);
  const complete = response();
  await updateTechnicianJobCard({ params: { jobId: job._id }, user: technician, body: { action: 'completeJob', reportNotes: 'Oil and filter replaced.' } }, complete);
  assert.equal(complete.code, 200); assert.equal(job.status, 'Ready'); assert.equal(appointment.status, 'Completed'); assert.equal(invoice.paymentStatus, 'Draft'); assert.equal(invoice.totalAmount, 0);
  assert.ok(job.completedAt);
  assert.deepEqual(job.finalReport.workDone, ['Oil and filter replaced.']);
  const edit = response(); await updateTechnicianJobCard({ params: { jobId: job._id }, user: technician, body: { action: 'partAdd', name: 'Extra', quantity: 1, unitCost: 50 } }, edit); assert.equal(edit.code, 409);
  const paymentBody = { invoiceId: invoice._id, method: 'Bank Transfer', transactionReference: 'BANK-001' };
  const beforeIssue = response(); await submitCustomerPayment({ user: customer, body: paymentBody }, beforeIssue); assert.equal(beforeIssue.code, 404);
  const issue = response(); await updateDraftInvoice({ params: { invoiceId: invoice._id }, body: { finalize: true, parts: [{ ...invoice.parts[0], unitPrice: 500 }], labourItems: [{ ...invoice.labourItems[0], rate: 1000 }] } }, issue); assert.equal(issue.code, 200); assert.equal(invoice.paymentStatus, 'Pending');
  const submit = response(); await submitCustomerPayment({ user: customer, body: paymentBody }, submit); assert.equal(submit.code, 201); assert.equal(payments[0].status, 'Pending Verification'); assert.equal(invoice.amountPaid, 0);
  const duplicate = response(); await submitCustomerPayment({ user: customer, body: paymentBody }, duplicate); assert.equal(duplicate.code, 409);
  const failed = response(); await reviewFinancePayment({ params: { paymentId: payments[0]._id }, user: { _id: id(7) }, body: { decision: 'Failed', failureReason: 'Reference not found' } }, failed); assert.equal(failed.code, 200); assert.equal(invoice.paymentStatus, 'Pending');
  const retry = response(); await submitCustomerPayment({ user: customer, body: { ...paymentBody, transactionReference: 'BANK-002' } }, retry); assert.equal(retry.code, 201);
  const paid = response(); await reviewFinancePayment({ params: { paymentId: payments[1]._id }, user: { _id: id(7) }, body: { decision: 'Completed' } }, paid); assert.equal(paid.code, 200); assert.equal(invoice.paymentStatus, 'Paid'); assert.equal(invoice.amountPaid, 2000);
});

test('technician cannot enter charges; admin prices the completed service', async t => {
  const technician = { _id: id(21), role: 'Technician', name: 'Technician 2' };
  const customer = { _id: id(22) };
  let job = {
    _id: id(23),
    serviceNumber: 'JOB-DIRECT',
    technician: technician._id,
    customer: customer._id,
    status: 'In Progress',
    technicianAcceptedAt: new Date(),
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

  // Technician price submissions must fail.
  const addServiceCharge = response();
  await updateTechnicianJobCard({
    params: { jobId: job._id },
    user: technician,
    body: { action: 'labourAdd', description: 'Periodic General Service', amount: 3500 }
  }, addServiceCharge);

  assert.equal(addServiceCharge.code, 403);
  assert.equal(job.labourEntries.length, 0);

  // Completion prepares an unpriced draft for admin.
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
  assert.equal(invoice.labourCost, 0);
  assert.equal(invoice.totalAmount, 0);
  const price = response();
  await updateDraftInvoice({ params: { invoiceId: invoice._id }, body: { adminChargeDescription: 'Periodic General Service', adminChargeAmount: 3500, finalize: true } }, price);
  assert.equal(price.code, 200);
  assert.equal(invoice.totalAmount, 3500);
});

test('technician can edit a recorded part while preserving admin-only pricing', async t => {
  const technician = { _id: id(31), role: 'Technician', name: 'Technician' };
  const part = { _id: id(32), name: 'Old filter', partNumber: 'OLD-1', quantity: 1, unitCost: 1200 };
  const parts = [part];
  parts.id = value => parts.find(entry => entry._id === value);
  const job = { _id: id(33), technician: technician._id, status: 'In Progress', technicianAcceptedAt: new Date(), replacedParts: parts, timeline: [], async save() {} };
  t.mock.method(ServiceJob, 'findOne', async () => job);

  const result = response();
  await updateTechnicianJobCard({ params: { jobId: job._id }, user: technician, body: { action: 'partUpdate', partId: part._id, name: 'Air filter', partNumber: 'AIR-2', quantity: 2 } }, result);
  assert.equal(result.code, 200);
  assert.equal(part.name, 'Air filter');
  assert.equal(part.partNumber, 'AIR-2');
  assert.equal(part.quantity, 2);
  assert.equal(part.unitCost, 1200, 'technician edits do not alter the admin-entered price');

  const invalid = response();
  await updateTechnicianJobCard({ params: { jobId: job._id }, user: technician, body: { action: 'partUpdate', partId: part._id, name: 'Air filter', quantity: 0 } }, invalid);
  assert.equal(invalid.code, 400);
});

