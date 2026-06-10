import { useState, useEffect } from 'react';
import CompChart from './components/CompChart';
import EventForm from './components/EventForm';
import DashboardStats from './components/DashboardStats';
import { Sparkles, Sun, Moon } from 'lucide-react';

const getInitialState = () => {
  const savedTheme = localStorage.getItem('comp_graph_theme') || 'dark';

  // 7-day local storage expiration check
  const savedTimestamp = localStorage.getItem('comp_graph_storage_timestamp');
  if (savedTimestamp) {
    const ageMs = Date.now() - Number(savedTimestamp);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (ageMs > sevenDaysMs) {
      // Clear expired career progression data
      localStorage.removeItem('comp_graph_salary_events');
      localStorage.removeItem('comp_graph_comp_events');
      localStorage.removeItem('comp_graph_start_date');
      localStorage.removeItem('comp_graph_currency');
      localStorage.removeItem('comp_graph_user_name');
      localStorage.removeItem('comp_graph_storage_timestamp');

      return {
        salaryEvents: [],
        compEvents: [],
        startDate: '2024-01',
        currency: 'USD',
        theme: savedTheme
      };
    }
  }

  const savedSalary = localStorage.getItem('comp_graph_salary_events');
  const savedComp = localStorage.getItem('comp_graph_comp_events');
  const savedStartDate = localStorage.getItem('comp_graph_start_date') || '2024-01';
  const savedCurrency = localStorage.getItem('comp_graph_currency') || 'USD';

  if (savedSalary && savedComp) {
    try {
      return {
        salaryEvents: JSON.parse(savedSalary),
        compEvents: JSON.parse(savedComp),
        startDate: savedStartDate,
        currency: savedCurrency,
        theme: savedTheme
      };
    } catch {
      // Fallback on JSON parse error
    }
  }

  return {
    salaryEvents: [],
    compEvents: [],
    startDate: savedStartDate,
    currency: savedCurrency,
    theme: savedTheme
  };
};

export default function App() {
  const [initialState] = useState(getInitialState);

  const [salaryEvents, setSalaryEvents] = useState(initialState.salaryEvents);
  const [compEvents, setCompEvents] = useState(initialState.compEvents);
  const [startDate, setStartDate] = useState(initialState.startDate);
  const [currency, setCurrency] = useState(initialState.currency);
  const [theme, setTheme] = useState(initialState.theme);

  // User details state
  const [userName, setUserName] = useState(() => localStorage.getItem('comp_graph_user_name') || '');
  const [showUserModal, setShowUserModal] = useState(() => !localStorage.getItem('comp_graph_user_name'));

  const [modalName, setModalName] = useState(userName);

  // Sync modal inputs if userName changes during render
  const [prevUserName, setPrevUserName] = useState(userName);
  if (userName !== prevUserName) {
    setPrevUserName(userName);
    setModalName(userName);
  }

  // Save to local storage on changes
  useEffect(() => {
    if (salaryEvents.length > 0 || compEvents.length > 0) {
      localStorage.setItem('comp_graph_salary_events', JSON.stringify(salaryEvents));
      localStorage.setItem('comp_graph_comp_events', JSON.stringify(compEvents));
      localStorage.setItem('comp_graph_start_date', startDate);
      localStorage.setItem('comp_graph_currency', currency);
      localStorage.setItem('comp_graph_theme', theme);
    }
  }, [salaryEvents, compEvents, startDate, currency, theme]);

  // Apply theme to document body
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // Handle user info form submission
  const handleUserSubmit = (e) => {
    e.preventDefault();
    const trimmedName = modalName.trim();
    if (!trimmedName) return;

    localStorage.setItem('comp_graph_user_name', trimmedName);
    // Explicitly clean up any legacy email entries to honor privacy guidelines
    localStorage.removeItem('comp_graph_user_email');
    setUserName(trimmedName);
    setShowUserModal(false);
  };

  // Add a new salary change event
  const handleAddSalaryEvent = (event) => {
    const newEvent = {
      id: `s_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      ...event
    };
    
    setSalaryEvents((prev) => {
      // Check if an event already exists on this month
      const filtered = prev.filter(e => e.date !== event.date);
      const updated = [...filtered, newEvent].sort((a, b) => a.date.localeCompare(b.date));
      return updated;
    });
  };

  // Add a new financial event (bonus, grant, vest)
  const handleAddCompEvent = (event) => {
    const newEvent = {
      id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      ...event
    };
    
    setCompEvents((prev) => {
      const updated = [...prev, newEvent].sort((a, b) => a.date.localeCompare(b.date));
      return updated;
    });
  };

  // Delete a salary event
  const handleDeleteSalaryEvent = (id) => {
    setSalaryEvents((prev) => prev.filter(e => e.id !== id));
  };

  // Delete a comp event
  const handleDeleteCompEvent = (id) => {
    setCompEvents((prev) => prev.filter(e => e.id !== id));
  };

  // Import custom JSON data backup
  const handleImportJSON = ({ userName: importedName, salaryEvents, compEvents, startDate, currency }) => {
    setSalaryEvents(salaryEvents);
    setCompEvents(compEvents);
    setStartDate(startDate);
    setCurrency(currency);
    
    if (importedName) {
      localStorage.setItem('comp_graph_user_name', importedName);
      setUserName(importedName);
      setShowUserModal(false);
    }
  };

  // Clear all data
  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all data? This will empty the graph.")) {
      setSalaryEvents([]);
      setCompEvents([]);
    }
  };

  return (
    <div className="app-container">
      {/* User Info Prompt Modal */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel animate-fade-in" style={{ padding: '2.5rem 2rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: '700', fontSize: '1.4rem' }}>
              <Sparkles style={{ color: 'var(--color-primary)' }} />
              Welcome to CompGraph
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.4 }}>
              Enter your name to initialize your personalized career dashboard. <strong>Your data is stored 100% client-side in your local browser and never leaves your machine.</strong>
            </p>
            <form onSubmit={handleUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Pushkal Pandey" 
                  value={modalName} 
                  onChange={(e) => setModalName(e.target.value)} 
                  required 
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    marginTop: '0.25rem'
                  }}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%', padding: '0.6rem' }}>
                Get Started
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header Area */}
      <header className="header animate-fade-in">
        <div className="header-title-area">
          <h1>
            <Sparkles size={28} style={{ color: 'var(--color-primary)' }} />
            <span>{userName ? `${userName}'s CompGraph` : 'CompGraph'}</span>
          </h1>
          <p>Visually plan and analyze your base salary milestones, cash bonuses, and equity grants over time.</p>
          {userName && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Dashboard for: <strong style={{ color: 'var(--text-secondary)' }}>{userName}</strong> •{' '}
              <button 
                onClick={() => setShowUserModal(true)}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', textDecoration: 'underline', padding: 0, font: 'inherit', cursor: 'pointer', fontWeight: 600 }}
              >
                Edit Profile
              </button>
              <span style={{ margin: '0 0.5rem', opacity: 0.5 }}>|</span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                💡 Recommendation: Export your JSON regularly to keep offline backups of your milestones.
              </span>
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
          <div className="preset-selector">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Timeline Start Month
            </span>
            <input
              type="month"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.85rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                marginTop: '0.25rem',
                display: 'block'
              }}
            />
          </div>

          <div className="preset-selector">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Currency
            </span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.85rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                marginTop: '0.25rem',
                display: 'block',
                height: '35px',
                width: '120px'
              }}
            >
              <option value="USD">USD ($)</option>
              <option value="INR">INR (₹)</option>
              <option value="GBP">GBP (£)</option>
              <option value="EUR">EUR (€)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="CAD">CAD (CA$)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="SGD">SGD (SG$)</option>
            </select>
          </div>

          <div className="preset-selector" style={{ minWidth: 'auto' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Theme
            </span>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="preset-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '35px',
                height: '35px',
                padding: 0,
                marginTop: '0.25rem'
              }}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          <div className="preset-selector" style={{ minWidth: 'auto' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Actions
            </span>
            <button
              onClick={handleClearAll}
              className="preset-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '35px',
                padding: '0 0.85rem',
                marginTop: '0.25rem',
                color: '#ef4444',
                borderColor: 'rgba(239, 68, 68, 0.2)'
              }}
            >
              Clear Graph
            </button>
          </div>
        </div>
      </header>

      {/* KPI Section */}
      <DashboardStats salaryEvents={salaryEvents} compEvents={compEvents} startDate={startDate} currency={currency} />

      {/* Main Grid View */}
      <div className="dashboard-grid">
        {/* Left Side: Graph Visualizer */}
        <div className="main-content">
          <CompChart 
            salaryEvents={salaryEvents} 
            compEvents={compEvents} 
            startDate={startDate} 
            currency={currency} 
            userName={userName}
            onImportJSON={handleImportJSON} 
          />
        </div>

        {/* Right Side: Control Panels & Forms */}
        <aside className="sidebar-panel">
          <EventForm 
            salaryEvents={salaryEvents}
            compEvents={compEvents}
            onAddSalaryEvent={handleAddSalaryEvent}
            onAddCompEvent={handleAddCompEvent}
            onDeleteSalaryEvent={handleDeleteSalaryEvent}
            onDeleteCompEvent={handleDeleteCompEvent}
            startDate={startDate}
            currency={currency}
          />
        </aside>
      </div>

      <footer style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          CompGraph &copy; 2026. Made with high-fidelity React SVGs. Hover nodes to view tooltips.
        </p>
      </footer>
    </div>
  );
}
