export const dashboardForRole = role => ({
  Customer: '/customer/dashboard', user: '/customer/dashboard',
  Admin: '/admin/dashboard', admin: '/admin/dashboard',
  Technician: '/technician/dashboard', Finance: '/finance/dashboard',
}[role] || '/login');
