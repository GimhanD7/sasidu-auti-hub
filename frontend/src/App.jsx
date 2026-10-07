import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import CustomerLayout from './components/Layout/CustomerLayout';
import CustomerDashboard from './pages/Customer/CustomerDashboard';
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
        
        {/* Add more routes here like /admin, /technician */}
      </Routes>
    </Router>
  );
}

export default App;
