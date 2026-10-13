// Describe saved changes centrally so every role receives consistent feedback.
export function mutationToastMessage(config = {}, response = {}) {
  const method = config.method?.toLowerCase();
  if (!['post', 'put', 'patch', 'delete'].includes(method)) return null;
  const path = (config.url || '').split('?')[0].replace(/\/$/, '');
  let body = config.data || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  let message;
  if (/^\/appointments(?:\/[^/]+(?:\/(?:cancel|cancellation-request|reschedule-request))?)?$/.test(path)) {
    if (path.endsWith('/cancellation-request')) message = 'Cancellation requested. Your appointment stays active until the admin cancels it.';
    else if (path.endsWith('/reschedule-request')) message = 'Reschedule request sent for workshop review.';
    else if (path.endsWith('/cancel')) message = 'Appointment cancelled successfully.';
    else message = method === 'post' ? 'Appointment booked successfully. Awaiting admin confirmation.' : 'Appointment updated successfully.';
  } else if (/^\/vehicles(?:\/[^/]+)?$/.test(path)) {
    message = method === 'delete' ? 'Vehicle deleted successfully.' : method === 'post' ? 'Vehicle added successfully.' : 'Vehicle updated successfully.';
  } else if (/^\/auth\/technician\/appointments\/[^/]+\/start$/.test(path)) {
    message = response?.alreadyCreated ? 'Service is already started.' : 'Service started successfully.';
  } else if (/^\/auth\/technician\/jobs\/[^/]+\/card$/.test(path)) {
    const actions = {
      acceptJob: 'Job accepted successfully.',
      partAdd: 'Part added successfully.',
      partRemove: 'Part removed successfully.',
      labourAdd: 'Service charge added successfully.',
      labourRemove: 'Service charge removed successfully.',
      completeJob: 'Service completed successfully.',
      repairNote: 'Repair note saved successfully.',
      taskAdd: 'Task added successfully.',
      taskUpdate: 'Task updated successfully.',
      labourTimerStart: 'Labour timer started successfully.',
      labourTimerStop: 'Labour timer stopped successfully.',
    };
    message = actions[body.action] || 'Service updated successfully.';
  } else if (path.startsWith('/admin/')) {
    const resource = path.split('/')[2];
    const labels = { appointments: 'Appointment', vehicles: 'Vehicle', customers: 'Customer', technicians: 'Technician', 'service-types': 'Service type', jobs: 'Service job', invoices: 'Invoice', payments: 'Payment' };
    const label = labels[resource];
    if (!label) return null;
    if (resource === 'appointments' && body.status === 'Cancelled') message = 'Appointment cancelled successfully.';
    else if (resource === 'appointments' && body.status === 'Confirmed') message = 'Appointment confirmed successfully.';
    else if (body.rescheduleDecision) message = `Reschedule request ${body.rescheduleDecision.toLowerCase()}.`;
    else if (path.endsWith('/technician')) message = body.technicianId ? 'Technician assignment updated successfully.' : 'Technician assignment removed successfully.';
    else if (path.endsWith('/availability')) message = 'Technician availability updated successfully.';
    else if (path.endsWith('/deactivate')) message = `${label} deactivated successfully.`;
    else if (path.endsWith('/activate')) message = `${label} activated successfully.`;
    else if (path.endsWith('/status')) message = `${label} status updated successfully.`;
    else if (path.endsWith('/review')) message = 'Payment review saved successfully.';
    else if (resource === 'invoices' && body.finalize) message = 'Invoice finalized successfully.';
    else message = `${label} ${method === 'delete' ? 'deleted' : method === 'post' ? 'created' : 'updated'} successfully.`;
  } else if (path === '/customer-payments') {
    message = 'Payment submitted successfully. Awaiting admin verification.';
  } else if (path === '/auth/me') {
    message = 'Profile updated successfully.';
  } else if (path === '/auth/change-password') {
    message = 'Password changed successfully.';
  } else return null;
  return typeof response?.message === 'string' && response.message.trim() ? response.message : message;
}
