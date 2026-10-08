import React from 'react';
import '../Customer/CustomerDashboard.css'; // Reusing dashboard styles

const FinanceDashboard = () => {
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Billing & Revenue</h1>
          <p className="page-subtitle">Track invoices, pending payments, and overall workshop revenue.</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', padding: '0.75rem 1.5rem', backgroundColor: '#8b5cf6' }}>
          + Generate Invoice
        </button>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div className="card-info">
            <h3>Today's Revenue</h3>
            <p className="card-value">$2,450.00</p>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          </div>
          <div className="card-info">
            <h3>Monthly Revenue</h3>
            <p className="card-value">$45,200.00</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div className="card-info">
            <h3>Pending Invoices</h3>
            <p className="card-value">12</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <div className="card-info">
            <h3>Outstanding Value</h3>
            <p className="card-value">$4,150.00</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="grid-col-2">
          <div className="section-card">
            <div className="section-header">
              <h2>Recent Invoices</h2>
              <button className="btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>View All</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {/* Invoice Row 1 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'var(--bg-input)', borderRadius: '8px' }}>
                <div>
                  <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>INV-2026-1048</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Toyota Camry • Customer: John Miller</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>$350.00</p>
                    <p style={{ color: '#10b981', fontSize: '0.85rem' }}>PAID</p>
                  </div>
                  <button className="icon-btn">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                  </button>
                </div>
              </div>

              {/* Invoice Row 2 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'var(--bg-input)', borderRadius: '8px' }}>
                <div>
                  <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>INV-2026-1049</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Honda Civic • Customer: Sarah Jenkins</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>$120.00</p>
                    <p style={{ color: '#f59e0b', fontSize: '0.85rem' }}>PENDING</p>
                  </div>
                  <button className="icon-btn">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                  </button>
                </div>
              </div>

              {/* Invoice Row 3 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'var(--bg-input)', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                <div>
                  <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>INV-2026-1030</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Ford F-150 • Customer: Mike Ross</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>$1,250.00</p>
                    <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>OVERDUE</p>
                  </div>
                  <button className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Remind</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid-col-1">
          <div className="section-card" style={{ marginBottom: '2rem' }}>
            <div className="section-header">
              <h2>Recent Payments</h2>
            </div>
            <div className="notification-list">
              <div className="notification-item">
                <div className="notif-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>💳</div>
                <div className="notif-content">
                  <p><strong>$350.00 via Credit Card</strong></p>
                  <p>Applied to INV-2026-1048</p>
                  <span className="notif-time">2 hours ago</span>
                </div>
              </div>
              <div className="notification-item">
                <div className="notif-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>💵</div>
                <div className="notif-content">
                  <p><strong>$85.00 via Cash</strong></p>
                  <p>Applied to INV-2026-1047</p>
                  <span className="notif-time">5 hours ago</span>
                </div>
              </div>
              <div className="notification-item">
                <div className="notif-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>🌐</div>
                <div className="notif-content">
                  <p><strong>$420.00 via Online Transfer</strong></p>
                  <p>Applied to INV-2026-1045</p>
                  <span className="notif-time">Yesterday</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceDashboard;
