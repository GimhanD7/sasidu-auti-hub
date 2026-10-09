import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Auth/Login';
import Home from './pages/Home';
import Signup from './pages/Auth/Signup';
import CustomerLayout from './components/Layout/CustomerLayout';
import CustomerDashboard from './pages/Customer/CustomerDashboard';
import CustomerVehicles from './pages/Customer/CustomerVehicles';
import CustomerVehicleProfile from './pages/Customer/CustomerVehicleProfile';
import CustomerAppointments from './pages/Customer/CustomerAppointments';

import CustomerInvoices from './pages/Customer/CustomerInvoices';
import CustomerPayments from './pages/Customer/CustomerPayments';
import AdminLayout from './components/Layout/AdminLayout';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminAppointments from './pages/Admin/AdminAppointments';
import AdminCustomers from './pages/Admin/AdminCustomers';
import AdminVehicles from './pages/Admin/AdminVehicles';
import AdminTechnicians from './pages/Admin/AdminTechnicians';
import AdminAllocations from './pages/Admin/AdminAllocations';
import TechnicianLayout from './components/Layout/TechnicianLayout';
import TechnicianDashboard from './pages/Technician/TechnicianDashboard';
import TechnicianJobs from './pages/Technician/TechnicianJobs';
import TechnicianJobDetails from './pages/Technician/TechnicianJobDetails';

import FinanceInvoices from './pages/Finance/FinanceInvoices';
import FinancePaymentReview from './pages/Finance/FinancePaymentReview';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import PasswordReset from './pages/Auth/PasswordReset';
import Profile from './pages/Shared/Profile';

import Toast from './components/Toast';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toast />
        <Routes>
          {/* Auth Routes */}
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin/login" element={<Login adminOnly />} />
          <Route path="/technician/login" element={<Login technicianOnly />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<PasswordReset />} />
          <Route path="/reset-password" element={<PasswordReset reset />} />

          {/* Customer Portal Routes */}
          <Route element={<ProtectedRoute role="Customer" />}>
            <Route path="/customer" element={<CustomerLayout />}>
              <Route index element={<Navigate to="/customer/dashboard" replace />} />
              <Route path="dashboard" element={<CustomerDashboard />} />
              <Route path="vehicles">
                <Route index element={<CustomerVehicles />} />
                <Route path=":vehicleId" element={<CustomerVehicleProfile />} />
              </Route>
              <Route path="appointments" element={<CustomerAppointments />} />
              <Route path="appointments/book" element={<Navigate to="/customer/appointments" replace />} />
              <Route path="repair-approvals" element={<Navigate to="/customer/dashboard" replace />} />
              <Route path="invoices" element={<CustomerInvoices />} />
              <Route path="payments" element={<CustomerPayments />} />
              <Route path="account" element={<Profile />} />
              {/* Removed pages redirect to dashboard */}
              <Route path="repair-tracking" element={<Navigate to="/customer/dashboard" replace />} />
              <Route path="messages" element={<Navigate to="/customer/dashboard" replace />} />
              <Route path="notifications" element={<Navigate to="/customer/dashboard" replace />} />
              <Route path="history" element={<Navigate to="/customer/dashboard" replace />} />
            </Route>
          </Route>

          {/* Admin Portal Routes */}
          <Route element={<ProtectedRoute role="Admin" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="appointments" element={<AdminAppointments />} />
              <Route path="billing" element={<Navigate to="/admin/invoices" replace />} />
              <Route path="invoices" element={<FinanceInvoices />} />
              <Route path="payments" element={<FinancePaymentReview />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="vehicles" element={<AdminVehicles />} />
              <Route path="technicians" element={<AdminTechnicians />} />
              <Route path="allocations" element={<AdminAllocations />} />
              <Route path="account" element={<Profile />} />
              {/* Removed pages redirect to dashboard */}
              <Route path="kanban" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="messages" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="users" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="accounts" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="reports" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="services" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="service-types" element={<Navigate to="/admin/dashboard" replace />} />
            </Route>
          </Route>

          {/* Technician Portal Routes */}
          <Route element={<ProtectedRoute role="Technician" />}>
            <Route path="/technician" element={<TechnicianLayout />}>
              <Route index element={<Navigate to="/technician/dashboard" replace />} />
              <Route path="dashboard" element={<TechnicianDashboard />} />
              <Route path="account" element={<Profile />} />
              <Route path="jobs" element={<TechnicianJobs />} />
              <Route path="jobs/:jobId" element={<TechnicianJobDetails />} />
              {/* Removed pages redirect to dashboard */}
              <Route path="history" element={<Navigate to="/technician/dashboard" replace />} />
              <Route path="security" element={<Navigate to="/technician/dashboard" replace />} />
              <Route path="messages" element={<Navigate to="/technician/dashboard" replace />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute role="Admin" />}>
            <Route path="/finance" element={<Navigate to="/admin/invoices" replace />} />
            <Route path="/finance/dashboard" element={<Navigate to="/admin/invoices" replace />} />
            <Route path="/finance/invoices" element={<Navigate to="/admin/invoices" replace />} />
            <Route path="/finance/payments" element={<Navigate to="/admin/payments" replace />} />
            <Route path="/finance/reports" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/finance/account" element={<Navigate to="/admin/account" replace />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
