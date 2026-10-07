import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="app-header">
          <h1>Vehicle Service & Repair Tracking System</h1>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<div className="p-8">Welcome to the Vehicle Service Portal</div>} />
            {/* Add more routes here like /admin, /technician, /customer */}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
