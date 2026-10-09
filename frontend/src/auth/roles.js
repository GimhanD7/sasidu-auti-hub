// Choose the landing dashboard for an account role so authentication redirects stay consistent.
export const dashboardForRole = (role) =>
  ({
    Customer: '/customer/dashboard',
    user: '/customer/dashboard',
    Admin: '/admin/dashboard',
    admin: '/admin/dashboard',
    Technician: '/technician/dashboard',
  })[role] || '/login';
