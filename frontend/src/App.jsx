import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import CustomerLayout from './components/Layout/CustomerLayout';
import CustomerDashboard from './pages/Customer/CustomerDashboard';
import CustomerVehicles from './pages/Customer/CustomerVehicles';
import CustomerVehicleProfile from './pages/Customer/CustomerVehicleProfile';
import CustomerAppointments from './pages/Customer/CustomerAppointments';
import BookAppointment from './pages/Customer/BookAppointment';
import CustomerRepairTracking from './pages/Customer/CustomerRepairTracking';
import CustomerRepairApprovals from './pages/Customer/CustomerRepairApprovals';
import ServiceMessages from './pages/Shared/ServiceMessages';
import CustomerNotifications from './pages/Customer/CustomerNotifications';
import CustomerServiceHistory from './pages/Customer/CustomerServiceHistory';
import CustomerInvoices from './pages/Customer/CustomerInvoices';
import CustomerPayments from './pages/Customer/CustomerPayments';
import AdminLayout from './components/Layout/AdminLayout';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminAppointments from './pages/Admin/AdminAppointments';
import AdminCustomers from './pages/Admin/AdminCustomers';
import AdminVehicles from './pages/Admin/AdminVehicles';
import AdminServiceTypes from './pages/Admin/AdminServiceTypes';
import AdminTechnicians from './pages/Admin/AdminTechnicians';
import AdminAllocations from './pages/Admin/AdminAllocations';
import AdminKanban from './pages/Admin/AdminKanban';
import TechnicianLayout from './components/Layout/TechnicianLayout';
import TechnicianDashboard from './pages/Technician/TechnicianDashboard';
import TechnicianSecurity from './pages/Technician/TechnicianSecurity';
import TechnicianJobs from './pages/Technician/TechnicianJobs';
import TechnicianJobHistory from './pages/Technician/TechnicianJobHistory';
import TechnicianJobDetails from './pages/Technician/TechnicianJobDetails';
import FinanceLayout from './components/Layout/FinanceLayout';
import FinanceDashboard from './pages/Finance/FinanceDashboard';
import FinanceInvoices from './pages/Finance/FinanceInvoices';
import FinanceRevenueReports from './pages/Finance/FinanceRevenueReports';
import FinancePaymentReview from './pages/Finance/FinancePaymentReview';
import './App.css';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import PasswordReset from './pages/Auth/PasswordReset';
import AccountSettings from './pages/Shared/AccountSettings';

function App() {
  return (
    <AuthProvider>
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
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
          <Route path="appointments/book" element={<BookAppointment />} />
          <Route path="repair-tracking" element={<CustomerRepairTracking />} />
          <Route path="repair-approvals" element={<CustomerRepairApprovals />} />
          <Route path="messages" element={<ServiceMessages />} />
          <Route path="notifications" element={<CustomerNotifications />} />
          <Route path="history" element={<CustomerServiceHistory />} />
          <Route path="invoices" element={<CustomerInvoices />} />
          <Route path="payments" element={<CustomerPayments />} />
          <Route path="account" element={<AccountSettings />} />
        </Route>
        </Route>

        {/* Admin Portal Routes */}
        <Route element={<ProtectedRoute role="Admin" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="appointments" element={<AdminAppointments />} />
          <Route path="kanban" element={<AdminKanban />} />
          <Route path="messages" element={<ServiceMessages />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="vehicles" element={<AdminVehicles />} />
          <Route path="technicians" element={<AdminTechnicians />} />
          <Route path="allocations" element={<AdminAllocations />} />
          <Route path="services" element={<AdminServiceTypes />} />
          <Route path="account" element={<AccountSettings />} />
        </Route>
        </Route>
        
        {/* Technician Portal Routes */}
        <Route element={<ProtectedRoute role="Technician" />}>
        <Route path="/technician" element={<TechnicianLayout />}>
          <Route index element={<Navigate to="/technician/dashboard" replace />} />
          <Route path="dashboard" element={<TechnicianDashboard />} />
          <Route path="security" element={<TechnicianSecurity />} />
          <Route path="account" element={<AccountSettings />} />
          <Route path="messages" element={<ServiceMessages />} />
          <Route path="jobs" element={<TechnicianJobs />} />
          <Route path="history" element={<TechnicianJobHistory />} />
          <Route path="jobs/:jobId" element={<TechnicianJobDetails />} />
        </Route>
        </Route>

        {/* Finance Portal Routes */}
        <Route element={<ProtectedRoute role="Finance" />}>
        <Route path="/finance" element={<FinanceLayout />}>
          <Route index element={<Navigate to="/finance/dashboard" replace />} />
          <Route path="dashboard" element={<FinanceDashboard />} />
          <Route path="invoices" element={<FinanceInvoices />} />
          <Route path="payments" element={<FinancePaymentReview />} />
          <Route path="reports" element={<FinanceRevenueReports />} />
          <Route path="account" element={<AccountSettings />} />
        </Route>
        </Route>
      </Routes>
    </Router>
    </AuthProvider>
  );
}

export default App;
