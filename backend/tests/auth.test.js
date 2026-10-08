import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { createApp } from '../app.js';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import ServiceJob from '../models/ServiceJob.js';
import Notification from '../models/Notification.js';
import JobPhoto from '../models/JobPhoto.js';
import Invoice from '../models/Invoice.js';
import Vehicle from '../models/Vehicle.js';
import Payment from '../models/Payment.js';
import { passwordResetEmail } from '../services/passwordResetEmail.js';
import { hashToken } from '../utils/session.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

test('auth HTTP flow: credentials, cookies, access, logout and one-time password reset', async t => {
  const customer = { _id: 'customer', name: 'Test Customer', email: 'customer@example.com', mobile: '+94771234567', password: await bcrypt.hash('old-password', 10), role: 'user', isActive: true, sessionVersion: 0 };
  const financeUser = { _id: 'finance-user', name: 'Finance User', email: 'finance@example.com', password: await bcrypt.hash('finance-password', 10), role: 'Finance', isActive: true, sessionVersion: 0 };
  const users = [customer, financeUser];
  const sessions = [];
  let sentEmail;
  t.mock.method(User, 'findOne', async query => users.find(user => (!query.email || user.email === query.email) && (!query.mobile || user.mobile === query.mobile) && (!query.isActive || user.isActive !== false)) || null);
  t.mock.method(User, 'findById', id => ({ select: async () => users.find(user => user._id === id) || null }));
  t.mock.method(User, 'find', () => ({ select() { return this; }, lean: async () => [{ _id: 'admin-user' }] }));
  t.mock.method(User, 'updateOne', async (query, update) => {
    const user = users.find(user => user._id === query._id && (!query.resetTokenHash || user.resetTokenHash === query.resetTokenHash));
    if (user) {
      Object.assign(user, update.$set || {});
      for (const key of Object.keys(update.$unset || {})) delete user[key];
    }
    return { modifiedCount: user ? 1 : 0 };
  });
  t.mock.method(User, 'findOneAndUpdate', async (query, update) => {
    const user = users.find(user => user.resetTokenHash === query.resetTokenHash && user.resetTokenExpiresAt > query.resetTokenExpiresAt.$gt && user.isActive !== false);
    if (!user) return null;
    Object.assign(user, update.$set);
    user.sessionVersion += update.$inc.sessionVersion;
    for (const key of Object.keys(update.$unset)) delete user[key];
    return user;
  });
  t.mock.method(AuthSession, 'create', async data => { sessions.push(data); return data; });
  t.mock.method(AuthSession, 'findOne', async query => sessions.find(session => session.tokenHash === query.tokenHash && session.expiresAt > query.expiresAt.$gt) || null);
  t.mock.method(AuthSession, 'deleteOne', async query => {
    const index = sessions.findIndex(session => session.tokenHash === query.tokenHash);
    if (index !== -1) sessions.splice(index, 1);
  });
  t.mock.method(AuthSession, 'deleteMany', async query => {
    const remaining = sessions.filter(session => session.user !== query.user);
    const deletedCount = sessions.length - remaining.length;
    sessions.splice(0, sessions.length, ...remaining);
    return { deletedCount };
  });
  t.mock.method(passwordResetEmail, 'isConfigured', () => true);
  t.mock.method(passwordResetEmail, 'send', async (email, token) => { sentEmail = { email, token }; });
  const app = createApp();
  app.get('/test/admin', requireAuth, requireRole('Admin'), (req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { body, cookie, origin, method } = {}) {
    const response = await fetch(url + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  try {
    assert.equal((await request('/api/auth/me')).response.status, 401);
    assert.equal((await request('/api/auth/login', { body: { email: {} } })).response.status, 400);
    assert.equal((await request('/api/auth/login', { body: { email: customer.email, password: 'wrong' } })).response.status, 401);
    assert.equal((await request('/api/auth/login', { origin: 'https://other.example', body: { email: customer.email, password: 'old-password' } })).response.status, 403);
    const login = await request('/api/auth/login', { origin: 'http://localhost:5173', body: { email: ' CUSTOMER@example.com ', password: 'old-password', remember: true } });
    assert.equal(login.response.status, 200);
    assert.equal(login.data.role, 'Customer');
    assert.equal(login.data.password, undefined);
    assert.equal(login.data.token, undefined);
    assert.match(login.response.headers.get('set-cookie'), /HttpOnly/);
    assert.match(login.response.headers.get('set-cookie'), /SameSite=Lax/);
    assert.match(login.response.headers.get('set-cookie'), /Max-Age=2592000/);
    assert.equal(login.response.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(login.response.headers.get('cache-control'), 'no-store');
    assert.equal(sessions[0].tokenHash, hashToken(login.cookie.split('=')[1]));
    assert.equal((await request('/api/auth/me', { cookie: login.cookie })).data.fullName, customer.name);
    assert.equal((await request('/test/admin', { cookie: login.cookie })).response.status, 403);

    customer.isActive = false;
    assert.equal((await request('/api/auth/me', { cookie: login.cookie })).response.status, 401);
    assert.equal((await request('/api/auth/login', { body: { email: customer.email, password: 'old-password' } })).response.status, 401);
    customer.isActive = true;
    sessions[0].expiresAt = new Date(Date.now() - 1000);
    assert.equal((await request('/api/auth/me', { cookie: login.cookie })).response.status, 401);
    sessions[0].expiresAt = new Date(Date.now() + 60000);
    const logout = await request('/api/auth/logout', { cookie: login.cookie, body: {} });
    assert.equal(logout.response.status, 200);
    assert.match(logout.response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
    assert.equal((await request('/api/auth/me', { cookie: login.cookie })).response.status, 401);
    assert.equal((await request('/api/auth/logout', { body: {} })).response.status, 200);

    const mobileLogin = await request('/api/auth/login', { body: { email: '+94 (77) 123-4567', password: 'old-password' } });
    assert.equal(mobileLogin.response.status, 200);
    assert.doesNotMatch(mobileLogin.response.headers.get('set-cookie'), /Max-Age/);
    const known = await request('/api/auth/forgot-password', { body: { email: ' CUSTOMER@example.com ' } });
    const unknown = await request('/api/auth/forgot-password', { body: { email: 'unknown@example.com' } });
    assert.deepEqual(known.data, unknown.data);
    assert.equal(sentEmail.email, customer.email);
    assert.equal(customer.resetTokenHash, hashToken(sentEmail.token));
    assert.notEqual(customer.resetTokenHash, sentEmail.token);
    assert.ok(customer.resetTokenExpiresAt > new Date());
    assert.equal(known.data.token, undefined);
    assert.equal((await request('/api/auth/reset-password', { body: { token: sentEmail.token, password: 'new-password', confirmPassword: 'different' } })).response.status, 400);
    customer.resetTokenExpiresAt = new Date(Date.now() - 1000);
    assert.equal((await request('/api/auth/reset-password', { body: { token: sentEmail.token, password: 'new-password', confirmPassword: 'new-password' } })).response.status, 400);
    customer.resetTokenExpiresAt = new Date(Date.now() + 60000);
    const resetBody = { token: sentEmail.token, password: 'new-password', confirmPassword: 'new-password' };
    assert.equal((await request('/api/auth/reset-password', { body: resetBody })).response.status, 200);
    assert.equal(await bcrypt.compare('new-password', customer.password), true);
    assert.equal((await request('/api/auth/reset-password', { body: resetBody })).response.status, 400);
    assert.equal((await request('/api/auth/me', { cookie: mobileLogin.cookie })).response.status, 401);
    assert.equal((await request('/api/auth/login', { body: { email: customer.email, password: 'old-password' } })).response.status, 401);
    const customerCurrentLogin = await request('/api/auth/login', { body: { email: customer.email, password: 'new-password' } });
    assert.equal(customerCurrentLogin.response.status, 200);
    assert.equal(customer.resetTokenHash, undefined);

    const technician = {
      _id: 'technician', name: 'Test Technician', email: 'tech@example.com', mobile: '+94770000001',
      password: await bcrypt.hash('tech-password', 10), role: 'Technician', isActive: true, sessionVersion: 0,
      async save() { return this; },
    };
    users.push(technician);
    assert.equal((await request('/api/auth/technician/login', { body: { email: customer.email, password: 'new-password' } })).response.status, 403);
    const technicianLogin = await request('/api/auth/technician/login', { body: { email: technician.email, password: 'tech-password' } });
    assert.equal(technicianLogin.response.status, 200);
    assert.equal(technicianLogin.data.role, 'Technician');
    assert.match(technicianLogin.response.headers.get('set-cookie'), /HttpOnly/);
    assert.equal((await request('/api/auth/me', { cookie: technicianLogin.cookie })).data.role, 'Technician');
    const financeLogin = await request('/api/auth/login', { body: { email: financeUser.email, password: 'finance-password' } });
    assert.equal(financeLogin.response.status, 200);
    const dashboardJobs = [
      { _id: '64f000000000000000000001', serviceNumber: 'JOB-ACTIVE', status: 'In Progress', priority: 'Urgent', customerComplaint: 'Brake noise', updatedAt: new Date(), customer: { name: 'Workshop Customer' }, vehicle: { make: 'Toyota', model: 'Corolla', year: 2022, registrationNumber: 'ABC-1234' }, appointment: { serviceType: 'Brake repair', preferredDate: new Date(), preferredTime: '09:00' } },
      { _id: '64f000000000000000000002', serviceNumber: 'JOB-PENDING', status: 'Inspecting', priority: 'High', updatedAt: new Date(), customer: { name: 'Workshop Customer' }, vehicle: { make: 'Honda', model: 'Civic', registrationNumber: 'XYZ-9876' }, appointment: { serviceType: 'Inspection', preferredDate: new Date(), preferredTime: '10:00' } },
      { _id: '64f000000000000000000003', serviceNumber: 'JOB-READY', status: 'Ready', priority: 'Normal', updatedAt: new Date(), customer: { name: 'Workshop Customer' }, vehicle: { make: 'Suzuki', model: 'Swift' }, appointment: { serviceType: 'Repair', preferredDate: new Date(), preferredTime: '11:00' } },
    ];
    dashboardJobs[2].timeline = [{ status: 'Ready', timestamp: new Date('2026-10-01T10:00:00.000Z') }];
    dashboardJobs[0].inspection = { findings: '', diagnosis: '', notes: '', issues: [], recommendedRepairs: [] };
    dashboardJobs[0].repairNotes = [];
    dashboardJobs[0].tasks = [];
    dashboardJobs[0].tasks.id = id => dashboardJobs[0].tasks.find(task => String(task._id) === String(id));
    dashboardJobs[0].replacedParts = [];
    dashboardJobs[0].replacedParts.id = id => dashboardJobs[0].replacedParts.find(part => String(part._id) === String(id));
    dashboardJobs[0].replacedParts.pull = id => {
      const index = dashboardJobs[0].replacedParts.findIndex(part => String(part._id) === String(id));
      if (index >= 0) dashboardJobs[0].replacedParts.splice(index, 1);
    };
    dashboardJobs[0].labourEntries = [];
    dashboardJobs[0].additionalRepairs = [];
    dashboardJobs[0].timeline = [];
    dashboardJobs[0].$locals = {};
    dashboardJobs[0].save = async function save() { return this; };
    dashboardJobs[1].additionalRepairs = [];
    dashboardJobs[1].additionalRepairs.id = id => dashboardJobs[1].additionalRepairs.find(repair => String(repair._id) === String(id));
    dashboardJobs[1].tasks = [{ _id: '64f000000000000000000040', title: 'Replace worn belt', status: 'Pending', notes: '' }, { _id: '64f000000000000000000041', title: 'Inspect pulley', status: 'Pending', notes: '' }];
    dashboardJobs[1].tasks.id = id => dashboardJobs[1].tasks.find(task => String(task._id) === String(id));
    dashboardJobs[1].inspection = { findings: '', diagnosis: '', notes: '', issues: [], recommendedRepairs: [] };
    dashboardJobs[1].timeline = [];
    dashboardJobs[1].$locals = {};
    dashboardJobs[1].save = async function save() { return this; };
    t.mock.method(ServiceJob, 'find', query => ({ select() { return this; }, populate() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => dashboardJobs.filter(job => (!query.status || job.status === query.status) && (!query.priority || job.priority === query.priority)) }));
    t.mock.method(ServiceJob, 'findOne', query => {
      const found = dashboardJobs.find(job => String(job._id) === String(query._id)) || null;
      const pending = Promise.resolve(found);
      pending.populate = () => pending;
      pending.lean = async () => found;
      return pending;
    });
    t.mock.method(ServiceJob, 'countDocuments', async query => query.timeline ? 1 : query.status === 'Inspecting' ? 1 : query.status === 'In Progress' ? 1 : query.status === 'Waiting for Approval' ? 0 : query.status === 'Ready' ? 1 : query.priority ? 2 : Object.keys(query).length === 1 && query.technician ? dashboardJobs.length : 0);
    t.mock.method(ServiceJob, 'aggregate', async () => [{ name: 'Brake pad set', partNumber: 'BP-01', unitPrice: 125, lastUsedAt: new Date() }]);
    t.mock.method(Vehicle, 'find', () => ({ select() { return this; }, limit() { return this; }, lean: async () => [] }));
    const dashboardNotifications = [{ _id: 'notice-1', type: 'ServiceJobAssigned', title: 'New job assigned', message: 'JOB-ACTIVE is ready.', link: '/technician/jobs', isRead: false, createdAt: new Date() }];
    t.mock.method(Notification, 'find', () => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => dashboardNotifications }));
    t.mock.method(Notification, 'countDocuments', async () => 1);
    const deliveredNotifications = [];
    t.mock.method(Notification, 'insertMany', async items => { deliveredNotifications.push(...items); return items; });
    t.mock.method(Invoice, 'findOne', async () => null);
    t.mock.method(Invoice, 'create', async data => ({ ...data, _id: '64f000000000000000000060' }));
    t.mock.method(Invoice, 'countDocuments', async query => query.paymentStatus === 'Paid' ? 3 : query.paymentStatus === 'Overdue' ? 2 : query.paymentStatus?.$in ? 2 : 7);
    t.mock.method(Invoice, 'aggregate', async () => [{ total: 1250 }]);
    const dashboardPayments = [{ _id: 'payment-1', amount: 250, method: 'Bank Transfer', receiptNumber: 'RCPT-001', status: 'Completed', createdAt: new Date(), reviewedAt: new Date(), customer: { name: 'Billing Customer' }, invoice: { invoiceNumber: 'INV-001' } }];
    t.mock.method(Payment, 'aggregate', async pipeline => pipeline[1]?.$group?._id && typeof pipeline[1].$group._id === 'object'
      ? [{ _id: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 }, total: 400 }]
      : [{ total: pipeline[0].$match.reviewedAt.$lt ? 100 : 400 }]);
    t.mock.method(Payment, 'find', () => ({ sort() { return this; }, limit() { return this; }, populate() { return this; }, lean: async () => dashboardPayments }));
    t.mock.method(JobPhoto, 'find', () => ({ select() { return this; }, sort() { return this; }, lean: async () => [] }));
    t.mock.method(JobPhoto, 'countDocuments', async () => 0);
    t.mock.method(JobPhoto, 'create', async photo => ({ ...photo, _id: '64f000000000000000000010', createdAt: new Date() }));
    const dashboard = await request('/api/auth/technician-dashboard', { cookie: technicianLogin.cookie });
    assert.equal(dashboard.response.status, 200);
    assert.deepEqual(dashboard.data.summary, { assigned: 1, inProgress: 1, waitingForApproval: 0, completedToday: 1, completed: 1, highPriority: 2, today: 2 });
    assert.equal(dashboard.data.activeJob.serviceNumber, 'JOB-ACTIVE');
    assert.equal(dashboard.data.pendingJobs[0].serviceNumber, 'JOB-PENDING');
    assert.equal(dashboard.data.completedJobs[0].serviceNumber, 'JOB-READY');
    assert.equal(dashboard.data.notifications[0].title, 'New job assigned');
    assert.equal((await request('/api/finance/dashboard', { cookie: customerCurrentLogin.cookie })).response.status, 403);
    const financeDashboard = await request('/api/finance/dashboard', { cookie: financeLogin.cookie });
    assert.equal(financeDashboard.response.status, 200);
    assert.equal(financeDashboard.data.summary.todayRevenue, 100);
    assert.equal(financeDashboard.data.summary.monthlyRevenue, 400);
    assert.equal(financeDashboard.data.summary.totalInvoices, 7);
    assert.equal(financeDashboard.data.summary.outstandingValue, 1250);
    assert.equal(financeDashboard.data.revenueByMonth.length, 6);
    assert.equal(financeDashboard.data.recentPayments[0].invoiceNumber, 'INV-001');
    const spareParts = await request('/api/auth/technician/parts?search=brake', { cookie: technicianLogin.cookie });
    assert.equal(spareParts.response.status, 200);
    assert.equal(spareParts.data.parts[0].unitPrice, 125);
    assert.equal((await request('/api/auth/technician/parts?search=brake', { cookie: customerCurrentLogin.cookie })).response.status, 403);
    const myJobs = await request('/api/auth/technician/jobs?status=In%20Progress&sort=recent&page=1', { cookie: technicianLogin.cookie });
    assert.equal(myJobs.response.status, 200);
    assert.equal(myJobs.data.total, 1);
    assert.equal(myJobs.data.jobs.length, 1);
    assert.equal(myJobs.data.jobs[0].serviceType, 'Brake repair');
    const history = await request('/api/auth/technician/jobs/history?search=JOB-READY', { cookie: technicianLogin.cookie });
    assert.equal(history.response.status, 200);
    assert.equal(history.data.total, 1);
    assert.equal(history.data.jobs[0].serviceNumber, 'JOB-READY');
    assert.equal(history.data.jobs[0].completedAt, '2026-10-01T10:00:00.000Z');
    assert.equal((await request('/api/auth/technician/jobs/history', { cookie: customerCurrentLogin.cookie })).response.status, 403);
    const jobDetails = await request('/api/auth/technician/jobs/64f000000000000000000001', { cookie: technicianLogin.cookie });
    assert.equal(jobDetails.response.status, 200);
    assert.equal(jobDetails.data.job.priority, 'Urgent');
    assert.equal(jobDetails.data.job.expectedCompletionTime, null);
    assert.equal((await request('/api/auth/technician/jobs/64f000000000000000000099', { cookie: technicianLogin.cookie })).response.status, 404);
    const repairNote = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'repairNote', note: 'Customer notified of inspection results.' } });
    assert.equal(repairNote.response.status, 200);
    assert.equal(dashboardJobs[0].repairNotes[0].note, 'Customer notified of inspection results.');
    const diagnosticUpdate = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'diagnosticReport', result: 'Brake pads below service limit.', issueCategory: 'Brakes', faultDescription: 'Front pads are worn and rotor has scoring.', recommendedAction: 'Replace front brake pads and inspect rotor thickness.', severity: 'High', estimatedRepairHours: 1.5 } });
    assert.equal(diagnosticUpdate.response.status, 200);
    assert.equal(dashboardJobs[0].diagnosticReport.estimatedRepairMinutes, 90);
    const invalidDiagnostic = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'diagnosticReport', result: 'Test', issueCategory: 'Invalid', faultDescription: 'Fault', recommendedAction: 'Repair', severity: 'High', estimatedRepairHours: 1 } });
    assert.equal(invalidDiagnostic.response.status, 400);
    const photoUpload = await request('/api/auth/technician/jobs/64f000000000000000000001/photos', { cookie: technicianLogin.cookie, body: { filename: 'brake.png', contentType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/bWsAAAAASUVORK5CYII=' } });
    assert.equal(photoUpload.response.status, 201);
    assert.equal(photoUpload.data.photo.filename, 'brake.png');
    const inspectionBeforeStart = await request('/api/auth/technician/jobs/64f000000000000000000002/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'inspection', findings: 'Finding', diagnosis: 'Diagnosis' } });
    assert.equal(inspectionBeforeStart.response.status, 409);
    const repairBeforeInspection = await request('/api/auth/technician/jobs/64f000000000000000000002/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'status', status: 'In Progress' } });
    assert.equal(repairBeforeInspection.response.status, 409);
    const inspectionStart = await request('/api/auth/technician/jobs/64f000000000000000000002/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'inspectionStart' } });
    assert.equal(inspectionStart.response.status, 200);
    const inspectionUpdate = await request('/api/auth/technician/jobs/64f000000000000000000002/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'inspection', findings: 'Belt cracking', diagnosis: 'Belt replacement recommended', issues: ['Drive belt crack'], recommendedRepairs: ['Replace drive belt'], notes: 'Checked under inspection lamp.' } });
    assert.equal(inspectionUpdate.response.status, 200);
    const inspectionImage = await request('/api/auth/technician/jobs/64f000000000000000000002/photos', { cookie: technicianLogin.cookie, body: { filename: 'belt.png', contentType: 'image/png', category: 'Inspection', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/bWsAAAAASUVORK5CYII=' } });
    assert.equal(inspectionImage.response.status, 201);
    assert.equal(inspectionImage.data.photo.category, 'Inspection');
    const repairEvidence = await request('/api/auth/technician/jobs/64f000000000000000000001/photos', { cookie: technicianLogin.cookie, body: { filename: 'damaged-belt.png', contentType: 'image/png', category: 'RepairEvidence', evidenceType: 'Damaged Part', description: 'Cracks across the belt ribs.', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/bWsAAAAASUVORK5CYII=' } });
    assert.equal(repairEvidence.response.status, 201);
    assert.equal(repairEvidence.data.photo.evidenceType, 'Damaged Part');
    assert.equal(repairEvidence.data.photo.description, 'Cracks across the belt ribs.');
    const inspectionComplete = await request('/api/auth/technician/jobs/64f000000000000000000002/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'inspection', findings: 'Belt cracking', diagnosis: 'Belt replacement recommended', issues: ['Drive belt crack'], recommendedRepairs: ['Replace drive belt'], notes: 'Checked under inspection lamp.', complete: true } });
    assert.equal(inspectionComplete.response.status, 200);
    assert.ok(dashboardJobs[1].inspection.completedAt);
    assert.equal(dashboardJobs[1].timeline.at(-1).status, 'Inspection Completed');
    const startRepairs = await request('/api/auth/technician/jobs/64f000000000000000000002/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'status', status: 'In Progress', notes: 'Inspection is complete; we are beginning the approved repair.' } });
    assert.equal(startRepairs.response.status, 200);
    const taskAdd = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'taskAdd', title: 'Replace front pads' } });
    assert.equal(taskAdd.response.status, 200);
    dashboardJobs[0].tasks[0]._id = '64f000000000000000000020';
    const taskUpdate = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'taskUpdate', taskId: '64f000000000000000000020', title: 'Replace front brake pads', notes: 'Used OEM replacement pads.', status: 'Complete' } });
    assert.equal(taskUpdate.response.status, 200);
    assert.equal(dashboardJobs[0].tasks[0].title, 'Replace front brake pads');
    assert.equal(dashboardJobs[0].tasks[0].notes, 'Used OEM replacement pads.');
    assert.ok(dashboardJobs[0].tasks[0].completedAt);
    const partAdd = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'partAdd', name: 'Brake pad set', partNumber: 'BP-01', quantity: 1, unitCost: 125 } });
    assert.equal(partAdd.response.status, 200);
    assert.equal(dashboardJobs[0].replacedParts[0].unitCost, 125);
    dashboardJobs[0].replacedParts[0]._id = '64f000000000000000000030';
    const partRemove = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'partRemove', partId: '64f000000000000000000030' } });
    assert.equal(partRemove.response.status, 200);
    assert.equal(dashboardJobs[0].replacedParts.length, 0);
    const labourAdd = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'labourAdd', description: 'Brake service', labourType: 'Repair', hours: 1.5, ratePerHour: 80 } });
    assert.equal(labourAdd.response.status, 200);
    assert.equal(dashboardJobs[0].labourEntries[0].minutes, 90);
    assert.equal(dashboardJobs[0].labourEntries[0].ratePerHour, 80);
    const timerStart = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'labourTimerStart', description: 'Brake test', labourType: 'Testing', ratePerHour: 60 } });
    assert.equal(timerStart.response.status, 200);
    assert.ok(dashboardJobs[0].activeLabourTimer.startedAt);
    const secondTimerStart = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'labourTimerStart', description: 'Duplicate', labourType: 'Repair', ratePerHour: 60 } });
    assert.equal(secondTimerStart.response.status, 409);
    dashboardJobs[0].activeLabourTimer.startedAt = new Date(Date.now() - 5 * 60000);
    const timerStop = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'labourTimerStop' } });
    assert.equal(timerStop.response.status, 200);
    assert.equal(dashboardJobs[0].labourEntries[1].labourType, 'Testing');
    assert.ok(dashboardJobs[0].labourEntries[1].minutes >= 5 && dashboardJobs[0].labourEntries[1].minutes <= 6);
    assert.equal(dashboardJobs[0].activeLabourTimer, undefined);
    const approvalRequest = await request('/api/auth/technician/jobs/64f000000000000000000002/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'approvalRequest', description: 'Replace worn belt', explanation: 'Cracking found during inspection.', relatedTaskId: '64f000000000000000000040', parts: [{ name: 'Drive belt', quantity: 2, unitCost: 90 }], labourCost: 60 } });
    assert.equal(approvalRequest.response.status, 200);
    assert.equal(dashboardJobs[1].status, 'Waiting for Approval');
    assert.equal(dashboardJobs[1].additionalRepairs[0].estimatedCost, 240);
    assert.equal(dashboardJobs[1].additionalRepairs[0].parts[0].totalCost, 180);
    dashboardJobs[1].additionalRepairs[0]._id = '64f000000000000000000050';
    const pendingApprovalList = await request('/api/repair-approvals', { cookie: customerCurrentLogin.cookie });
    assert.equal(pendingApprovalList.response.status, 200);
    assert.ok(pendingApprovalList.data.some(repair => repair.status === 'Pending' && repair.estimatedCost === 240));
    const rejectedDecision = await request('/api/repair-approvals/64f000000000000000000002/repairs/64f000000000000000000050/decision', { method: 'PATCH', cookie: customerCurrentLogin.cookie, body: { decision: 'Rejected', comment: 'Please do not replace this yet.' } });
    assert.equal(rejectedDecision.response.status, 200);
    assert.equal(dashboardJobs[1].tasks[0].status, 'Cancelled');
    assert.equal(dashboardJobs[1].additionalRepairs[0].customerComment, 'Please do not replace this yet.');
    assert.equal(dashboardJobs[1].status, 'In Progress');
    assert.match(dashboardJobs[1].timeline.at(-1).notes, /Please do not replace this yet/);
    const secondApproval = await request('/api/auth/technician/jobs/64f000000000000000000002/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'approvalRequest', description: 'Inspect pulley', explanation: 'Pulley bearing has play.', relatedTaskId: '64f000000000000000000041', parts: [], labourCost: 20 } });
    assert.equal(secondApproval.response.status, 200);
    dashboardJobs[1].additionalRepairs[1]._id = '64f000000000000000000051';
    const approvedDecision = await request('/api/repair-approvals/64f000000000000000000002/repairs/64f000000000000000000051/decision', { method: 'PATCH', cookie: customerCurrentLogin.cookie, body: { decision: 'Approved', comment: 'Approved, please proceed.' } });
    assert.equal(approvedDecision.response.status, 200);
    assert.equal(dashboardJobs[1].status, 'In Progress');
    assert.equal(dashboardJobs[1].timeline.at(-1).status, 'Additional repair approved');
    const technicianApprovalView = await request('/api/auth/technician/jobs/64f000000000000000000002', { cookie: technicianLogin.cookie });
    assert.equal(technicianApprovalView.response.status, 200);
    assert.equal(technicianApprovalView.data.job.additionalRepairs[0].status, 'Rejected');
    assert.equal(technicianApprovalView.data.job.additionalRepairs[0].customerComment, 'Please do not replace this yet.');
    assert.equal(technicianApprovalView.data.job.additionalRepairs[1].status, 'Approved');
    const statusUpdate = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'status', status: 'Final Test', notes: 'Repair tasks are complete; final safety checks are underway.' } });
    assert.equal(statusUpdate.response.status, 200);
    assert.equal(dashboardJobs[0].status, 'Final Test');
    assert.equal(dashboardJobs[0].timeline.at(-1).notes, 'Repair tasks are complete; final safety checks are underway.');
    const earlyReady = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'status', status: 'Ready', notes: 'Attempting to mark this ready before testing.' } });
    assert.equal(earlyReady.response.status, 409);
    const finalTestStart = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'finalTestStart' } });
    assert.equal(finalTestStart.response.status, 200);
    const incompleteFinalTest = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'finalTestComplete', checklist: [] } });
    assert.equal(incompleteFinalTest.response.status, 400);
    const finalTestItems = ['Brakes', 'Steering', 'Lights and signals', 'Tyres and wheels', 'Fluid leaks', 'Road test'];
    const failedFinalTest = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'finalTestComplete', checklist: finalTestItems.map(item => ({ item, result: item === 'Brakes' ? 'Failed' : 'Passed' })), notes: 'Brake pedal travel exceeds specification.', unresolvedIssue: 'Brake pedal still feels soft.' } });
    assert.equal(failedFinalTest.response.status, 200);
    assert.equal(dashboardJobs[0].finalTest.result, 'Failed');
    assert.equal(dashboardJobs[0].status, 'In Progress');
    const restartFinalTest = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'status', status: 'Final Test', notes: 'Brake system adjusted; beginning final checks again.' } });
    assert.equal(restartFinalTest.response.status, 200);
    assert.equal((await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'finalTestStart' } })).response.status, 200);
    const passedFinalTest = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'finalTestComplete', checklist: finalTestItems.map(item => ({ item, result: 'Passed' })), notes: 'All checks passed on the second test.' } });
    assert.equal(passedFinalTest.response.status, 200);
    assert.equal(dashboardJobs[0].finalTest.result, 'Passed');
    const readyUpdate = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'completeJob', tasksVerified: true, partsVerified: true, labourVerified: true, reportNotes: 'Brake service completed and final test passed.' } });
    assert.equal(readyUpdate.response.status, 200);
    assert.equal(dashboardJobs[0].status, 'Ready');
    assert.equal(dashboardJobs[0].billingInvoice, '64f000000000000000000060');
    assert.equal(dashboardJobs[0].finalReport.notes, 'Brake service completed and final test passed.');
    assert.equal(readyUpdate.data.invoice.paymentStatus, 'Draft');
    assert.ok(readyUpdate.data.invoice.totalAmount >= 125 && readyUpdate.data.invoice.totalAmount <= 126);
    assert.ok(deliveredNotifications.some(notification => notification.type === 'ServiceJobCompleted'));
    assert.equal((await request('/api/auth/technician-dashboard', { cookie: customerCurrentLogin.cookie })).response.status, 403);
    assert.equal((await request('/api/auth/technician/change-password', {
      cookie: technicianLogin.cookie, body: { currentPassword: 'incorrect', newPassword: 'better-tech-password', confirmPassword: 'better-tech-password' },
    })).response.status, 400);
    assert.equal((await request('/api/auth/technician/change-password', {
      cookie: technicianLogin.cookie, body: { currentPassword: 'tech-password', newPassword: 'short', confirmPassword: 'short' },
    })).response.status, 400);
    const changed = await request('/api/auth/technician/change-password', {
      cookie: technicianLogin.cookie,
      body: { currentPassword: 'tech-password', newPassword: 'better-tech-password', confirmPassword: 'better-tech-password' },
    });
    assert.equal(changed.response.status, 200);
    assert.match(changed.response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
    assert.equal(technician.sessionVersion, 1);
    assert.equal(sessions.some(session => session.user === technician._id), false);
    assert.equal((await request('/api/auth/me', { cookie: technicianLogin.cookie })).response.status, 401);
    assert.equal((await request('/api/auth/technician/login', { body: { email: technician.email, password: 'tech-password' } })).response.status, 401);
    assert.equal((await request('/api/auth/technician/login', { body: { email: technician.email, password: 'better-tech-password' } })).response.status, 200);

    passwordResetEmail.isConfigured = () => false;
    assert.equal((await request('/api/auth/forgot-password', { body: { email: customer.email } })).response.status, 503);
    assert.equal((await request('/api/auth/forgot-password', { body: { email: 'unknown@example.com' } })).response.status, 503);
    for (let i = 0; i < 5; i++) await request('/api/auth/forgot-password', { body: { email: 'unknown@example.com' } });
    assert.equal((await request('/api/auth/forgot-password', { body: { email: 'unknown@example.com' } })).response.status, 429);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
