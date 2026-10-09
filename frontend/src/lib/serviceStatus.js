export const serviceStatus = status => ({ Ready: 'Completed', Inspecting: 'In Progress', 'Final Test': 'In Progress', 'Waiting for Approval': 'In Progress', 'In Service': 'In Progress', 'Checked In': 'Confirmed' }[status] || status);
export const invoiceStatus = status => status === 'Pending' ? 'Unpaid' : status;
