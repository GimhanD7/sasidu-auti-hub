import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { createApp } from '../app.js';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import ServiceJob from '../models/ServiceJob.js';
import Notification from '../models/Notification.js';
import JobPhoto from '../models/JobPhoto.js';
import { passwordResetEmail } from '../services/passwordResetEmail.js';
import { hashToken } from '../utils/session.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

test('auth HTTP flow: credentials, cookies, access, logout and one-time password reset', async t => {
  const customer = { _id: 'customer', name: 'Test Customer', email: 'customer@example.com', mobile: '+94771234567', password: await bcrypt.hash('old-password', 10), role: 'user', isActive: true, sessionVersion: 0 };
  const users = [customer];
  const sessions = [];
  let sentEmail;
  t.mock.method(User, 'findOne', async query => users.find(user => (!query.email || user.email === query.email) && (!query.mobile || user.mobile === query.mobile) && (!query.isActive || user.isActive !== false)) || null);
  t.mock.method(User, 'findById', id => ({ select: async () => users.find(user => user._id === id) || null }));
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
    const dashboardJobs = [
      { _id: '64f000000000000000000001', serviceNumber: 'JOB-ACTIVE', status: 'In Progress', priority: 'Urgent', customerComplaint: 'Brake noise', updatedAt: new Date(), customer: { name: 'Workshop Customer' }, vehicle: { make: 'Toyota', model: 'Corolla', year: 2022, registrationNumber: 'ABC-1234' }, appointment: { serviceType: 'Brake repair', preferredDate: new Date(), preferredTime: '09:00' } },
      { _id: '64f000000000000000000002', serviceNumber: 'JOB-PENDING', status: 'Inspecting', priority: 'High', updatedAt: new Date(), customer: { name: 'Workshop Customer' }, vehicle: { make: 'Honda', model: 'Civic', registrationNumber: 'XYZ-9876' }, appointment: { serviceType: 'Inspection', preferredDate: new Date(), preferredTime: '10:00' } },
      { _id: '64f000000000000000000003', serviceNumber: 'JOB-READY', status: 'Ready', priority: 'Normal', updatedAt: new Date(), customer: { name: 'Workshop Customer' }, vehicle: { make: 'Suzuki', model: 'Swift' }, appointment: { serviceType: 'Repair', preferredDate: new Date(), preferredTime: '11:00' } },
    ];
    dashboardJobs[0].inspection = { findings: '', diagnosis: '', notes: '', issues: [], recommendedRepairs: [] };
    dashboardJobs[0].repairNotes = [];
    dashboardJobs[0].tasks = [];
    dashboardJobs[0].tasks.id = id => dashboardJobs[0].tasks.find(task => String(task._id) === String(id));
    dashboardJobs[0].replacedParts = [];
    dashboardJobs[0].labourEntries = [];
    dashboardJobs[0].additionalRepairs = [];
    dashboardJobs[0].timeline = [];
    dashboardJobs[0].save = async function save() { return this; };
    dashboardJobs[1].additionalRepairs = [];
    dashboardJobs[1].inspection = { findings: '', diagnosis: '', notes: '', issues: [], recommendedRepairs: [] };
    dashboardJobs[1].timeline = [];
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
    const dashboardNotifications = [{ _id: 'notice-1', type: 'ServiceJobAssigned', title: 'New job assigned', message: 'JOB-ACTIVE is ready.', link: '/technician/jobs', isRead: false, createdAt: new Date() }];
    t.mock.method(Notification, 'find', () => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => dashboardNotifications }));
    t.mock.method(Notification, 'countDocuments', async () => 1);
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
    const myJobs = await request('/api/auth/technician/jobs?status=In%20Progress&sort=recent&page=1', { cookie: technicianLogin.cookie });
    assert.equal(myJobs.response.status, 200);
    assert.equal(myJobs.data.total, 1);
    assert.equal(myJobs.data.jobs.length, 1);
    assert.equal(myJobs.data.jobs[0].serviceType, 'Brake repair');
    const jobDetails = await request('/api/auth/technician/jobs/64f000000000000000000001', { cookie: technicianLogin.cookie });
    assert.equal(jobDetails.response.status, 200);
    assert.equal(jobDetails.data.job.priority, 'Urgent');
    assert.equal(jobDetails.data.job.expectedCompletionTime, null);
    assert.equal((await request('/api/auth/technician/jobs/64f000000000000000000099', { cookie: technicianLogin.cookie })).response.status, 404);
    const repairNote = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'repairNote', note: 'Customer notified of inspection results.' } });
    assert.equal(repairNote.response.status, 200);
    assert.equal(dashboardJobs[0].repairNotes[0].note, 'Customer notified of inspection results.');
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
    const inspectionComplete = await request('/api/auth/technician/jobs/64f000000000000000000002/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'inspection', findings: 'Belt cracking', diagnosis: 'Belt replacement recommended', issues: ['Drive belt crack'], recommendedRepairs: ['Replace drive belt'], notes: 'Checked under inspection lamp.', complete: true } });
    assert.equal(inspectionComplete.response.status, 200);
    assert.ok(dashboardJobs[1].inspection.completedAt);
    assert.equal(dashboardJobs[1].timeline.at(-1).status, 'Inspection Completed');
    const startRepairs = await request('/api/auth/technician/jobs/64f000000000000000000002/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'status', status: 'In Progress' } });
    assert.equal(startRepairs.response.status, 200);
    const taskAdd = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'taskAdd', title: 'Replace front pads' } });
    assert.equal(taskAdd.response.status, 200);
    dashboardJobs[0].tasks[0]._id = '64f000000000000000000020';
    const taskUpdate = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'taskUpdate', taskId: '64f000000000000000000020', status: 'Complete' } });
    assert.equal(taskUpdate.response.status, 200);
    const partAdd = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'partAdd', name: 'Brake pad set', partNumber: 'BP-01', quantity: 1, unitCost: 125 } });
    assert.equal(partAdd.response.status, 200);
    assert.equal(dashboardJobs[0].replacedParts[0].unitCost, 125);
    const labourAdd = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'labourAdd', description: 'Brake service', hours: 1.5 } });
    assert.equal(labourAdd.response.status, 200);
    assert.equal(dashboardJobs[0].labourEntries[0].minutes, 90);
    const approvalRequest = await request('/api/auth/technician/jobs/64f000000000000000000002/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'approvalRequest', description: 'Replace worn belt', explanation: 'Cracking found during inspection.', estimatedCost: 240, labourCost: 60 } });
    assert.equal(approvalRequest.response.status, 200);
    assert.equal(dashboardJobs[1].status, 'Waiting for Approval');
    const statusUpdate = await request('/api/auth/technician/jobs/64f000000000000000000001/card', { method: 'PATCH', cookie: technicianLogin.cookie, body: { action: 'status', status: 'Final Test' } });
    assert.equal(statusUpdate.response.status, 200);
    assert.equal(dashboardJobs[0].status, 'Final Test');
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
