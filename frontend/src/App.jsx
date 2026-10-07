import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import CustomerLayout from './components/Layout/CustomerLayout';
import CustomerDashboard from './pages/Customer/CustomerDashboard';
import AdminLayout from './components/Layout/AdminLayout';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminKanban from './pages/Admin/AdminKanban';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
        {/* Customer Portal Routes */}
        <Route path="/customer" element={<CustomerLayout />}>
          <Route index element={<Navigate to="/customer/dashboard" replace />} />
          <Route path="dashboard" element={<CustomerDashboard />} />
          <Route path="vehicles" element={<div style={{padding: '2rem'}}>Vehicle Management (Coming Soon)</div>} />
          <Route path="appointments" element={<div style={{padding: '2rem'}}>Appointments (Coming Soon)</div>} />
          <Route path="repair-tracking" element={<div style={{padding: '2rem'}}>Live Repair Tracking (Coming Soon)</div>} />
          <Route path="history" element={<div style={{padding: '2rem'}}>Service History (Coming Soon)</div>} />
          <Route path="invoices" element={<div style={{padding: '2rem'}}>Invoices & Payments (Coming Soon)</div>} />
        </Route>

        {/* Admin Portal Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="appointments" element={<div style={{padding: '2rem'}}>Appointments & Calendar (Coming Soon)</div>} />
          <Route path="kanban" element={<AdminKanban />} />
          <Route path="customers" element={<div style={{padding: '2rem'}}>Customer Management (Coming Soon)</div>} />
          <Route path="technicians" element={<div style={{padding: '2rem'}}>Technician Management (Coming Soon)</div>} />
          <Route path="services" element={<div style={{padding: '2rem'}}>Service Type Management (Coming Soon)</div>} />
        </Route>
        
        {/* Add more routes here like /technician */}
      </Routes>
    </Router>
  );
}

export default App;
