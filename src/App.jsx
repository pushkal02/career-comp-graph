import { useState, useEffect } from 'react';
import CompChart from './components/CompChart';
import EventForm from './components/EventForm';
import DashboardStats from './components/DashboardStats';
import { Sparkles, Sun, Moon, X } from 'lucide-react';
import ShareCardModal from './components/ShareCardModal';
import { EXCHANGE_RATES, DEFAULT_PPP_FACTORS, COUNTRIES } from './utils/currency';

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

  // Dynamic rates and PPP factors caching states
  const [exchangeRates, setExchangeRates] = useState(EXCHANGE_RATES);
  const [pppFactors, setPppFactors] = useState(DEFAULT_PPP_FACTORS);
  const [pppMode, setPppMode] = useState(() => localStorage.getItem('comp_graph_ppp_mode') === 'true');

  // User details state
  const [userName, setUserName] = useState(() => localStorage.getItem('comp_graph_user_name') || '');
  const [showUserModal, setShowUserModal] = useState(() => !localStorage.getItem('comp_graph_user_name'));
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [showPppModal, setShowPppModal] = useState(false);

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

  // Save PPP Mode choice
  useEffect(() => {
    localStorage.setItem('comp_graph_ppp_mode', pppMode ? 'true' : 'false');
  }, [pppMode]);

  // Fetch live exchange rates and World Bank PPP factors with local caching
  useEffect(() => {
    const loadRatesAndPPP = async () => {
      const envVal = Number(import.meta.env.VITE_CACHE_DURATION_MS);
      const cacheDuration = !isNaN(envVal) ? envVal : 86400000;
      const cachedRatesStr = localStorage.getItem('comp_graph_cached_rates');
      const cachedPppStr = localStorage.getItem('comp_graph_cached_ppp');
      const cacheTimestamp = localStorage.getItem('comp_graph_cache_timestamp');
      const now = Date.now();

      if (cacheTimestamp && cachedRatesStr && cachedPppStr && (now - Number(cacheTimestamp) < cacheDuration)) {
        try {
          setExchangeRates(JSON.parse(cachedRatesStr));
          setPppFactors(JSON.parse(cachedPppStr));
          return;
        } catch {
          // Proceed to fetch on parse errors
        }
      }

      try {
        const ratesPromise = fetch('https://open.er-api.com/v6/latest/USD')
          .then(res => res.json())
          .then(data => {
            if (data && data.rates) {
              return data.rates;
            }
            throw new Error('Invalid exchange rates response');
          });

        const pppPromise = fetch('https://api.worldbank.org/v2/country/US;IN;GB;DE;JP;CA;AU;SG/indicator/PA.NUS.PRVT.PP?format=json&date=2023&per_page=50')
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
              const parsedPPP = {};
              data[1].forEach(item => {
                if (item.country && item.country.id && item.value !== null && item.value !== undefined) {
                  parsedPPP[item.country.id.toUpperCase()] = Number(item.value);
                }
              });
              return parsedPPP;
            }
            throw new Error('Invalid PPP response');
          });

        const [fetchedRates, fetchedPPP] = await Promise.all([ratesPromise, pppPromise]);

        const updatedRates = { ...EXCHANGE_RATES, ...fetchedRates };
        const updatedPPP = { ...DEFAULT_PPP_FACTORS, ...fetchedPPP };

        setExchangeRates(updatedRates);
        setPppFactors(updatedPPP);

        localStorage.setItem('comp_graph_cached_rates', JSON.stringify(updatedRates));
        localStorage.setItem('comp_graph_cached_ppp', JSON.stringify(updatedPPP));
        localStorage.setItem('comp_graph_cache_timestamp', now.toString());
      } catch (err) {
        console.error('Failed to fetch dynamic exchange rates or PPP factors, using defaults:', err);
        if (cachedRatesStr && cachedPppStr) {
          try {
            setExchangeRates(JSON.parse(cachedRatesStr));
            setPppFactors(JSON.parse(cachedPppStr));
          } catch {
            // Keep defaults
          }
        }
      }
    };

    loadRatesAndPPP();
  }, []);

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
      // Check if an event already exists on this month (YYYY-MM)
      const targetMonth = event.date.substring(0, 7);
      const filtered = prev.filter(e => e.date.substring(0, 7) !== targetMonth);
      const updated = [...filtered, newEvent].sort((a, b) => {
        const normA = a.date.length === 7 ? `${a.date}-01` : a.date;
        const normB = b.date.length === 7 ? `${b.date}-01` : b.date;
        return normA.localeCompare(normB);
      });
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
      const updated = [...prev, newEvent].sort((a, b) => {
        const normA = a.date.length === 7 ? `${a.date}-01` : a.date;
        const normB = b.date.length === 7 ? `${b.date}-01` : b.date;
        return normA.localeCompare(normB);
      });
      return updated;
    });
  };

  // Delete a salary event
  const handleDeleteSalaryEvent = (id) => {
    setSalaryEvents((prev) => prev.filter(e => e.id !== id));
  };

  // Edit an existing salary change event
  const handleEditSalaryEvent = (updatedEvent) => {
    setSalaryEvents((prev) => {
      // Filter out this event's old version and any other salary event on the updated date's month
      const targetMonth = updatedEvent.date.substring(0, 7);
      const filtered = prev.filter(e => e.id !== updatedEvent.id && e.date.substring(0, 7) !== targetMonth);
      const updated = [...filtered, updatedEvent].sort((a, b) => {
        const normA = a.date.length === 7 ? `${a.date}-01` : a.date;
        const normB = b.date.length === 7 ? `${b.date}-01` : b.date;
        return normA.localeCompare(normB);
      });
      return updated;
    });
  };

  // Edit an existing financial event (bonus, grant, vest)
  const handleEditCompEvent = (updatedEvent) => {
    setCompEvents((prev) => {
      const filtered = prev.filter(e => e.id !== updatedEvent.id);
      const updated = [...filtered, updatedEvent].sort((a, b) => {
        const normA = a.date.length === 7 ? `${a.date}-01` : a.date;
        const normB = b.date.length === 7 ? `${b.date}-01` : b.date;
        return normA.localeCompare(normB);
      });
      return updated;
    });
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
          <p style={{ color: 'var(--color-primary)', fontSize: '0.8rem', marginTop: '0.35rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>💡</span>
            <span>Recommendation: Export your JSON regularly to keep offline backups of your milestones.</span>
          </p>
          {userName && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Dashboard for: <strong style={{ color: 'var(--text-secondary)' }}>{userName}</strong> •{' '}
              <button 
                onClick={() => setShowUserModal(true)}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', textDecoration: 'underline', padding: 0, font: 'inherit', cursor: 'pointer', fontWeight: 600 }}
              >
                Edit Profile
              </button>
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
              PPP Mode
            </span>
            <button
              onClick={() => setPppMode(!pppMode)}
              className="preset-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '35px',
                padding: '0 0.85rem',
                marginTop: '0.25rem',
                fontWeight: 600,
                color: pppMode ? 'var(--color-primary)' : 'var(--text-primary)',
                borderColor: pppMode ? 'var(--color-primary)' : 'var(--border-color)',
                background: pppMode ? 'rgba(99, 102, 241, 0.15)' : 'transparent'
              }}
              title="Toggle Purchasing Power Parity (USD PPP) adjustment"
            >
              {pppMode ? 'ON (PPP $)' : 'OFF'}
            </button>
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
              Reference
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowRatesModal(true)}
                className="preset-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '35px',
                  padding: '0 0.85rem',
                  fontWeight: 600
                }}
                title="View active exchange rates relative to USD"
              >
                💱 Exchange Rates
              </button>
              <button
                onClick={() => setShowPppModal(true)}
                className="preset-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '35px',
                  padding: '0 0.85rem',
                  fontWeight: 600
                }}
                title="View World Bank PPP conversion factors"
              >
                📊 PPP Factors
              </button>
            </div>
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
      <DashboardStats 
        salaryEvents={salaryEvents} 
        compEvents={compEvents} 
        startDate={startDate} 
        currency={currency} 
        pppMode={pppMode}
        exchangeRates={exchangeRates}
        pppFactors={pppFactors}
      />

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
            onOpenShareCard={() => setShowShareModal(true)}
            pppMode={pppMode}
            exchangeRates={exchangeRates}
            pppFactors={pppFactors}
          />
        </div>

        {/* Right Side: Control Panels & Forms */}
        <aside className="sidebar-panel">
          <EventForm 
            salaryEvents={salaryEvents}
            compEvents={compEvents}
            onAddSalaryEvent={handleAddSalaryEvent}
            onAddCompEvent={handleAddCompEvent}
            onEditSalaryEvent={handleEditSalaryEvent}
            onEditCompEvent={handleEditCompEvent}
            onDeleteSalaryEvent={handleDeleteSalaryEvent}
            onDeleteCompEvent={handleDeleteCompEvent}
            startDate={startDate}
            currency={currency}
          />
        </aside>
      </div>

      <footer style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', paddingBottom: '1.5rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          CompGraph &copy; 2026. Created by Pushkal Pandey with ❤️ • Made with high-fidelity React SVGs.
        </p>
      </footer>

      <ShareCardModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        salaryEvents={salaryEvents}
        compEvents={compEvents}
        startDate={startDate}
        currency={currency}
        userName={userName}
        pppMode={pppMode}
        exchangeRates={exchangeRates}
        pppFactors={pppFactors}
      />

      {/* Nominal Exchange Rates Modal */}
      {showRatesModal && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content size-md glass-panel animate-fade-in" style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowRatesModal(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              title="Close"
            >
              <X size={18} />
            </button>

            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontWeight: '700', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              <span>💱</span> Active Nominal Exchange Rates
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>💵</span> Exchange Rates (Relative to 1 USD)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem' }}>
                  {Object.entries(exchangeRates).map(([curr, rate]) => (
                    <div key={curr} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem', textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{curr}</div>
                      <div style={{ color: 'var(--text-primary)', marginTop: '0.15rem', fontWeight: '700' }}>{Number(rate).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              Rates are fetched and cached daily according to your cache policy.
            </div>
          </div>
        </div>
      )}

      {/* World Bank PPP Factors Modal */}
      {showPppModal && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content size-md glass-panel animate-fade-in" style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowPppModal(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              title="Close"
            >
              <X size={18} />
            </button>

            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontWeight: '700', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              <span>📊</span> World Bank PPP Factors Reference
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>📈</span> World Bank PPP Factors (LCU per PPP $)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.5rem' }}>
                  {COUNTRIES.map(c => (
                    <div key={c.code} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem', textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                        <span>{c.flag}</span> <span>{c.code}</span>
                      </div>
                      <div style={{ color: 'var(--text-primary)', marginTop: '0.15rem', fontWeight: '700' }}>
                        {pppFactors[c.code] ? Number(pppFactors[c.code]).toFixed(3) : DEFAULT_PPP_FACTORS[c.code]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              PPP Factors are cached dynamically according to your cache policy.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
