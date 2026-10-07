import React, { useState } from 'react';
import './AdminKanban.css';

const AdminKanban = () => {
  // Mock data for visual demonstration
  const [jobs, setJobs] = useState([
    { id: 'JOB-1042', vehicle: 'Toyota Camry (2020)', reg: 'ABC-1234', status: 'Inspecting', priority: 'High', technician: 'Mike' },
    { id: 'JOB-1043', vehicle: 'Honda Civic (2018)', reg: 'XYZ-9876', status: 'In Progress', priority: 'Normal', technician: 'Sarah' },
    { id: 'JOB-1045', vehicle: 'Ford Mustang (2021)', reg: 'DEF-4567', status: 'In Progress', priority: 'Urgent', technician: 'Mike' },
    { id: 'JOB-1048', vehicle: 'Nissan Altima (2019)', reg: 'GHI-8901', status: 'Final Test', priority: 'Normal', technician: 'David' },
    { id: 'JOB-1050', vehicle: 'Tesla Model 3', reg: 'EV-1111', status: 'Ready', priority: 'Normal', technician: 'Sarah' }
  ]);

  const columns = ['Inspecting', 'In Progress', 'Final Test', 'Ready'];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Urgent': return '#ef4444';
      case 'High': return '#f59e0b';
      default: return '#3b82f6';
    }
  };

  return (
    <div className="kanban-container">
      <div className="kanban-header">
        <div>
          <h1 className="page-title">Workshop Job Board</h1>
          <p className="page-subtitle">Track and manage active service jobs</p>
        </div>
        <div className="kanban-filters">
          <input type="text" placeholder="Search by Job ID or Vehicle..." className="filter-input" />
          <select className="filter-select">
            <option>All Technicians</option>
            <option>Mike</option>
            <option>Sarah</option>
            <option>David</option>
          </select>
        </div>
      </div>

      <div className="kanban-board">
        {columns.map(col => (
          <div key={col} className="kanban-column">
            <div className="column-header">
              <h3>{col}</h3>
              <span className="column-count">{jobs.filter(j => j.status === col).length}</span>
            </div>
            
            <div className="column-body">
              {jobs.filter(j => j.status === col).map(job => (
                <div key={job.id} className="kanban-card">
                  <div className="card-top">
                    <span className="job-id">{job.id}</span>
                    <span className="priority-dot" style={{ backgroundColor: getPriorityColor(job.priority) }} title={`${job.priority} Priority`}></span>
                  </div>
                  <h4 className="job-vehicle">{job.vehicle}</h4>
                  <div className="job-details">
                    <span className="reg-number">{job.reg}</span>
                  </div>
                  <div className="card-bottom">
                    <div className="tech-avatar">{job.technician.charAt(0)}</div>
                    <span className="tech-name">{job.technician}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminKanban;
