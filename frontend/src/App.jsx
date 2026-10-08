import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import CustomerLayout from './components/Layout/CustomerLayout';
import CustomerDashboard from './pages/Customer/CustomerDashboard';
import CustomerVehicles from './pages/Customer/CustomerVehicles';
import AdminLayout from './components/Layout/AdminLayout';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminKanban from './pages/Admin/AdminKanban';
import TechnicianLayout from './components/Layout/TechnicianLayout';
import TechnicianDashboard from './pages/Technician/TechnicianDashboard';
import FinanceLayout from './components/Layout/FinanceLayout';
import FinanceDashboard from './pages/Finance/FinanceDashboard';
import './App.css';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import PasswordReset from './pages/Auth/PasswordReset';

function App() {
  return (
    <AuthProvider>
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<PasswordReset />} />
        <Route path="/reset-password" element={<PasswordReset reset />} />
        
        {/* Customer Portal Routes */}
        <Route element={<ProtectedRoute role="Customer" />}>
        <Route path="/customer" element={<CustomerLayout />}>
          <Route index element={<Navigate to="/customer/dashboard" replace />} />
          <Route path="dashboard" element={<CustomerDashboard />} />
          <Route path="vehicles" element={<CustomerVehicles />} />
          <Route path="appointments" element={<div style={{padding: '2rem'}}>Appointments (Coming Soon)</div>} />
          <Route path="repair-tracking" element={<div style={{padding: '2rem'}}>Live Repair Tracking (Coming Soon)</div>} />
          <Route path="history" element={<div style={{padding: '2rem'}}>Service History (Coming Soon)</div>} />
          <Route path="invoices" element={<div style={{padding: '2rem'}}>Invoices & Payments (Coming Soon)</div>} />
        </Route>
        </Route>

        {/* Admin Portal Routes */}
        <Route element={<ProtectedRoute role="Admin" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="appointments" element={<div style={{padding: '2rem'}}>Appointments & Calendar (Coming Soon)</div>} />
          <Route path="kanban" element={<AdminKanban />} />
          <Route path="customers" element={<div style={{padding: '2rem'}}>Customer Management (Coming Soon)</div>} />
          <Route path="technicians" element={<div style={{padding: '2rem'}}>Technician Management (Coming Soon)</div>} />
          <Route path="services" element={<div style={{padding: '2rem'}}>Service Type Management (Coming Soon)</div>} />
        </Route>
        </Route>
        
        {/* Technician Portal Routes */}
        <Route element={<ProtectedRoute role="Technician" />}>
        <Route path="/technician" element={<TechnicianLayout />}>
          <Route index element={<Navigate to="/technician/dashboard" replace />} />
          <Route path="dashboard" element={<TechnicianDashboard />} />
          <Route path="jobs" element={<div style={{padding: '2rem'}}>My Jobs (Coming Soon)</div>} />
          <Route path="history" element={<div style={{padding: '2rem'}}>Job History (Coming Soon)</div>} />
        </Route>
        </Route>

        {/* Finance Portal Routes */}
        <Route element={<ProtectedRoute role="Finance" />}>
        <Route path="/finance" element={<FinanceLayout />}>
          <Route index element={<Navigate to="/finance/dashboard" replace />} />
          <Route path="dashboard" element={<FinanceDashboard />} />
          <Route path="invoices" element={<div style={{padding: '2rem'}}>Invoice Management (Coming Soon)</div>} />
          <Route path="payments" element={<div style={{padding: '2rem'}}>Payment Processing (Coming Soon)</div>} />
          <Route path="reports" element={<div style={{padding: '2rem'}}>Revenue Reports (Coming Soon)</div>} />
        </Route>
        </Route>
      </Routes>
    </Router>
    </AuthProvider>
  );
}

export default App;
