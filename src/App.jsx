import { useState, useEffect } from 'react';
import CompChart from './components/CompChart';
import EventForm from './components/EventForm';
import DashboardStats from './components/DashboardStats';
import { Sparkles, X, LogOut, Eye, EyeOff, Check } from 'lucide-react';
import ShareCardModal from './components/ShareCardModal';
import AuthScreen from './components/AuthScreen';
import api from './utils/api';
import { EXCHANGE_RATES, DEFAULT_PPP_FACTORS, COUNTRIES, convertCurrency, convertToPPP } from './utils/currency';
import { sha256 } from './utils/crypto';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('comp_graph_token') || '');
  const [salaryEvents, setSalaryEvents] = useState([]);
  const [compEvents, setCompEvents] = useState([]);
  const [startDate, setStartDate] = useState('2024-01');
  const [currency, setCurrency] = useState('USD');
  const [theme, setTheme] = useState(() => localStorage.getItem('comp_graph_theme') || 'system');

  // Dynamic rates and PPP factors caching states
  const [exchangeRates, setExchangeRates] = useState(EXCHANGE_RATES);
  const [pppFactors, setPppFactors] = useState(DEFAULT_PPP_FACTORS);
  const [pppMode, setPppMode] = useState(false);

  // User profile modal states
  const [userName, setUserName] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [modalName, setModalName] = useState('');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const handleOpenUserModal = () => {
    setModalName(userName);
    setShowUserModal(true);
  };

  // Profile Settings password states
  const [profilePassword, setProfilePassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [profilePassError, setProfilePassError] = useState('');
  const [profilePassSuccess, setProfilePassSuccess] = useState('');
  const [profileShowPassword, setProfileShowPassword] = useState(false);
  const [profileShowConfirmPassword, setProfileShowConfirmPassword] = useState(false);
  const [profileResetLoading, setProfileResetLoading] = useState(false);

  // Password criteria for settings
  const profilePasswordCriteria = [
    { id: 'length', label: 'Min 8 characters', met: profilePassword.length >= 8 },
    { id: 'uppercase', label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(profilePassword) },
    { id: 'lowercase', label: 'One lowercase letter (a-z)', met: /[a-z]/.test(profilePassword) },
    { id: 'number', label: 'One number (0-9)', met: /[0-9]/.test(profilePassword) },
    { id: 'special', label: 'One special character', met: /[^A-Za-z0-9]/.test(profilePassword) }
  ];

  const isProfilePasswordStrong = profilePasswordCriteria.every(c => c.met);

  const [showShareModal, setShowShareModal] = useState(false);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [showPppModal, setShowPppModal] = useState(false);



  // Apply theme dynamically to body based on setting
  useEffect(() => {
    const applyTheme = () => {
      let resolvedTheme = theme;
      if (theme === 'system') {
        resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.body.setAttribute('data-theme', resolvedTheme);
    };

    applyTheme();

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e) => {
        document.body.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      };
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [theme]);

  // Sync token expiration events
  useEffect(() => {
    const handleAuthExpired = () => {
      setToken('');
      setSalaryEvents([]);
      setCompEvents([]);
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  // Fetch data on login or mount
  useEffect(() => {
    if (!token) return;

    const loadUserData = async () => {
      try {
        const [profile, events] = await Promise.all([
          api.auth.getProfile(),
          api.events.getEvents()
        ]);

        setUserName(profile.name);
        setStartDate(profile.startDate || '2024-01');
        setCurrency(profile.currency || 'USD');
        setTheme(profile.theme || 'system');
        setModalName(profile.name);

        setSalaryEvents(events.salaryEvents || []);
        setCompEvents(events.compEvents || []);
      } catch (err) {
        console.error('Failed to load user backend data:', err);
        alert(`Server connection failed: ${err.message}`);
      }
    };

    loadUserData();
  }, [token]);

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
        } catch (err) {
          console.warn('Failed to parse cached rates', err);
        }
      }

      try {
        const ratesPromise = fetch('https://open.er-api.com/v6/latest/USD')
          .then(res => res.json())
          .then(data => data.rates);

        const pppPromise = fetch('https://api.worldbank.org/v2/country/US;IN;GB;DE;JP;CA;AU;SG/indicator/PA.NUS.PRVT.PP?format=json&date=2023&per_page=50')
          .then(res => res.json())
          .then(data => {
            const parsedPPP = {};
            data[1].forEach(item => {
              if (item.country?.id && item.value !== null) {
                parsedPPP[item.country.id.toUpperCase()] = Number(item.value);
              }
            });
            return parsedPPP;
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
        console.error('Failed to update external rates', err);
      }
    };

    loadRatesAndPPP();
  }, []);

  const handleAuthSuccess = (newToken, user) => {
    localStorage.setItem('comp_graph_token', newToken);
    localStorage.setItem('comp_graph_user', JSON.stringify(user));
    localStorage.setItem('comp_graph_theme', user.theme || 'system');
    
    setToken(newToken);
    setTheme(user.theme || 'system');
    setUserName(user.name);
  };

  const handleLogout = () => {
    localStorage.removeItem('comp_graph_token');
    localStorage.removeItem('comp_graph_user');
    setToken('');
    setSalaryEvents([]);
    setCompEvents([]);
    setUserName('');
    setShowProfileDropdown(false);
  };

  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('comp_graph_theme', newTheme);
    if (token) {
      try {
        await api.auth.updateSettings({ theme: newTheme });
      } catch (err) {
        console.warn('Failed to update theme in database', err);
      }
    }
  };

  const handleStartDateChange = async (newDate) => {
    setStartDate(newDate);
    if (token) {
      try {
        await api.auth.updateSettings({ startDate: newDate });
      } catch (err) {
        console.warn('Failed to update startDate in database', err);
      }
    }
  };

  const handleCurrencyChange = async (newCurrency) => {
    setCurrency(newCurrency);
    if (token) {
      try {
        await api.auth.updateSettings({ currency: newCurrency });
      } catch (err) {
        console.warn('Failed to update currency in database', err);
      }
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = modalName.trim();
    if (!trimmedName) return;
    try {
      await api.auth.updateSettings({ name: trimmedName });
      setUserName(trimmedName);
      alert('Profile name updated!');
    } catch (err) {
      alert(`Failed to update profile: ${err.message}`);
    }
  };

  const handleProfilePasswordReset = async (e) => {
    e.preventDefault();
    setProfilePassError('');
    setProfilePassSuccess('');

    if (!isProfilePasswordStrong) {
      setProfilePassError('Password does not meet the strength criteria.');
      return;
    }

    if (profilePassword !== profileConfirmPassword) {
      setProfilePassError('Passwords do not match.');
      return;
    }

    setProfileResetLoading(true);
    try {
      const newHash = await sha256(profilePassword);
      await api.auth.updateSettings({ passwordHash: newHash });
      setProfilePassSuccess('Password successfully reset!');
      setProfilePassword('');
      setProfileConfirmPassword('');
    } catch (err) {
      setProfilePassError(err.message || 'Failed to reset password.');
    } finally {
      setProfileResetLoading(false);
    }
  };

  const handleGenerateProfilePassword = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let passwordChars = [];
    passwordChars.push(uppercase[Math.floor(Math.random() * uppercase.length)]);
    passwordChars.push(lowercase[Math.floor(Math.random() * lowercase.length)]);
    passwordChars.push(numbers[Math.floor(Math.random() * numbers.length)]);
    passwordChars.push(special[Math.floor(Math.random() * special.length)]);
    
    const allChars = uppercase + lowercase + numbers + special;
    for (let i = 0; i < 8; i++) {
      passwordChars.push(allChars[Math.floor(Math.random() * allChars.length)]);
    }
    
    for (let i = passwordChars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
    }
    
    const generated = passwordChars.join('');
    setProfilePassword(generated);
    setProfileConfirmPassword(generated);
    setProfilePassError('');
    setProfilePassSuccess(`Generated password: ${generated} (Copied to clipboard!)`);
    navigator.clipboard.writeText(generated);
  };



  const handleAddSalaryEvent = async (event) => {
    const newEvent = { id: `s_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, ...event };
    try {
      await api.events.createSalary(newEvent);
      setSalaryEvents((prev) => [...prev, newEvent].sort((a, b) => (a.date > b.date ? 1 : -1)));
    } catch (err) { alert(`Failed to save: ${err.message}`); }
  };

  const handleAddCompEvent = async (event) => {
    const newEvent = { id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, ...event };
    try {
      await api.events.createComp(newEvent);
      setCompEvents((prev) => [...prev, newEvent].sort((a, b) => (a.date > b.date ? 1 : -1)));
    } catch (err) { alert(`Failed to save: ${err.message}`); }
  };

  const handleEditSalaryEvent = async (updatedEvent) => {
    try {
      await api.events.updateSalary(updatedEvent.id, updatedEvent);
      setSalaryEvents((prev) => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e).sort((a, b) => (a.date > b.date ? 1 : -1)));
    } catch (err) { alert(`Failed to update: ${err.message}`); }
  };

  const handleEditCompEvent = async (updatedEvent) => {
    try {
      await api.events.updateComp(updatedEvent.id, updatedEvent);
      setCompEvents((prev) => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e).sort((a, b) => (a.date > b.date ? 1 : -1)));
    } catch (err) { alert(`Failed to update: ${err.message}`); }
  };

  const handleDeleteSalaryEvent = async (id) => {
    try {
      await api.events.deleteSalary(id);
      setSalaryEvents((prev) => prev.filter(e => e.id !== id));
    } catch (err) { alert(`Failed to delete: ${err.message}`); }
  };

  const handleDeleteCompEvent = async (id) => {
    try {
      await api.events.deleteComp(id);
      setCompEvents((prev) => prev.filter(e => e.id !== id));
    } catch (err) { alert(`Failed to delete: ${err.message}`); }
  };

  const handleBulkSync = async (salaries, comps) => {
    try {
      await api.events.syncEvents(salaries, comps);
      setSalaryEvents(salaries);
      setCompEvents(comps);
    } catch (err) { alert(`Failed to sync: ${err.message}`); }
  };

  const convertValue = (amount, eventCurrency, countryCode) => {
    if (pppMode) {
      return convertToPPP(amount, eventCurrency, countryCode, exchangeRates, pppFactors);
    } else {
      return convertCurrency(amount, eventCurrency, currency, exchangeRates);
    }
  };

  const exportJSON = () => {
    const data = {
      userName: userName || '',
      salaryEvents,
      compEvents,
      startDate: startDate || '2024-01',
      currency: currency || 'USD',
      exportDate: new Date().toISOString()
    };
    
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(jsonBlob);
    
    const a = document.createElement('a');
    a.download = `career-compensation-data-${startDate || '2024-01'}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const allEvents = [
      ...salaryEvents.map(e => ({
        date: e.date,
        category: 'Salary Remuneration',
        type: e.type,
        origVal: e.salary,
        origCurr: e.currency || 'USD',
        convVal: convertValue(e.salary, e.currency || 'USD', e.country),
        company: e.company || 'Self-Employed',
        country: e.country || '',
        location: e.location || '',
        title: e.title || '',
        monthlyGross: e.salary / 12,
        monthlyNet: e.monthlyNetSalary || ''
      })),
      ...compEvents.map(e => ({
        date: e.date,
        category: 'Compensation',
        type: e.type,
        origVal: e.amount,
        origCurr: e.currency || 'USD',
        convVal: convertValue(e.amount, e.currency || 'USD', e.country),
        company: e.company || 'Self-Employed',
        country: e.country || '',
        location: e.location || '',
        title: e.title || '',
        monthlyGross: '',
        monthlyNet: ''
      }))
    ].sort((a, b) => {
      const normA = a.date.length === 7 ? `${a.date}-01` : a.date;
      const normB = b.date.length === 7 ? `${b.date}-01` : b.date;
      return normA.localeCompare(normB);
    });

    const headers = ['Date', 'Category', 'Type', 'Original Amount', 'Original Currency', 'Converted Amount', 'Converted Currency', 'Monthly Gross', 'Monthly Net', 'Employer', 'Country', 'Location', 'Title'];
    const rows = allEvents.map(e => [
      escapeCSV(e.date),
      escapeCSV(e.category),
      escapeCSV(e.type),
      e.origVal,
      escapeCSV(e.origCurr),
      e.convVal,
      escapeCSV(pppMode ? 'USD (PPP)' : currency),
      e.monthlyGross,
      e.monthlyNet,
      escapeCSV(e.company),
      escapeCSV(e.country),
      escapeCSV(e.location),
      escapeCSV(e.title)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);

    const a = document.createElement('a');
    a.download = `career-compensation-data-${startDate || '2024-01'}.csv`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };





  if (!token) return <AuthScreen onAuthSuccess={handleAuthSuccess} />;

  return (
    <div className="app-container">

      {showUserModal && (
        <div className="modal-overlay animate-fade-in" style={{ zIndex: 999 }}>
          <div className="modal-content glass-panel profile-modal" style={{ padding: '2rem', maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => {
              setShowUserModal(false);
              setProfilePassword('');
              setProfileConfirmPassword('');
              setProfilePassError('');
              setProfilePassSuccess('');
            }} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              Profile & Account Settings
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Section 1: Edit Profile Info */}
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Personal Details</h3>
                <form onSubmit={handleUserSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input type="text" value={modalName} onChange={(e) => setModalName(e.target.value)} required style={{ flex: '1 1 200px', minWidth: 0, padding: '0.5rem 0.75rem', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }} />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', flex: '0 0 auto', whiteSpace: 'nowrap' }}>Save Name</button>
                </form>
              </div>

              {/* Section 2: Reset Password */}
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Reset Password</h3>
                  <button 
                    type="button" 
                    className="preset-btn" 
                    onClick={handleGenerateProfilePassword}
                    style={{ fontSize: '0.72rem', padding: '4px 8px', height: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    🔑 Generate Secure Password
                  </button>
                </div>

                {profilePassError && <div style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{profilePassError}</div>}
                {profilePassSuccess && <div style={{ color: '#4ade80', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{profilePassSuccess}</div>}

                <form onSubmit={handleProfilePasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                      <input 
                        type={profileShowPassword ? 'text' : 'password'} 
                        value={profilePassword} 
                        onChange={(e) => setProfilePassword(e.target.value)} 
                        placeholder="New Password" 
                        required 
                        style={{ width: '100%', padding: '0.5rem 0.75rem', paddingRight: '35px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }} 
                      />
                      <button
                        type="button"
                        onClick={() => setProfileShowPassword(!profileShowPassword)}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title={profileShowPassword ? 'Hide' : 'Show'}
                      >
                        {profileShowPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>

                    <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                      <input 
                        type={profileShowConfirmPassword ? 'text' : 'password'} 
                        value={profileConfirmPassword} 
                        onChange={(e) => setProfileConfirmPassword(e.target.value)} 
                        placeholder="Confirm Password" 
                        required 
                        style={{ width: '100%', padding: '0.5rem 0.75rem', paddingRight: '35px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }} 
                      />
                      <button
                        type="button"
                        onClick={() => setProfileShowConfirmPassword(!profileShowConfirmPassword)}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title={profileShowConfirmPassword ? 'Hide' : 'Show'}
                      >
                        {profileShowConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {profilePassword && (
                    <div className={`password-strength-checklist ${isProfilePasswordStrong ? 'strong' : ''}`} style={{ margin: '0' }}>
                      <div className="password-strength-header">
                        <span>Password Requirements</span>
                        <span className={`password-strength-status ${isProfilePasswordStrong ? 'strong' : 'weak'}`}>
                          {isProfilePasswordStrong ? 'Strong' : 'Weak - Need Strong Password'}
                        </span>
                      </div>
                      <ul className="password-criteria-list">
                        {profilePasswordCriteria.map((c) => (
                          <li key={c.id} className={`password-criteria-item ${c.met ? 'met' : 'unmet'}`}>
                            {c.met ? <Check size={12} /> : <X size={12} />}
                            <span>{c.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={profileResetLoading || !isProfilePasswordStrong}
                    style={{ padding: '0.5rem 1.25rem', alignSelf: 'flex-start', marginTop: '4px' }}
                  >
                    Change Password
                  </button>
                </form>
              </div>

              {/* Section 3: Data Actions (Export/Reset) */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Data Maintenance & Portability</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {/* CSV Exporter */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Export CSV Spreadsheet</span>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Download all events in standard CSV format for Excel/Sheets.</p>
                      <button 
                        type="button"
                        onClick={exportCSV} 
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', marginTop: 'auto', display: 'block', width: '100%', padding: '0.4rem' }} 
                      >
                        📥 Export CSV
                      </button>
                    </div>

                    {/* JSON Exporter */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Export JSON Backup</span>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Download complete database backup in JSON format.</p>
                      <button 
                        type="button"
                        onClick={exportJSON} 
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', marginTop: 'auto', display: 'block', width: '100%', padding: '0.4rem' }} 
                      >
                        📥 Export JSON
                      </button>
                    </div>
                  </div>


                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <header className="header animate-fade-in">
        <div className="header-title-area">
          <h1><Sparkles size={28} style={{ color: 'var(--color-primary)' }} /> {userName}'s CompGraph</h1>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
          <div className="preset-selector">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Start Month</span>
            <input type="month" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', marginTop: '0.25rem', display: 'block' }} />
          </div>
          <div className="preset-selector">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Currency</span>
            <select value={currency} onChange={(e) => handleCurrencyChange(e.target.value)} style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', marginTop: '0.25rem', display: 'block', height: '35px', width: '120px' }}>
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
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>PPP Mode</span>
            <button onClick={() => setPppMode(!pppMode)} className="preset-btn" style={{ display: 'flex', alignItems: 'center', justifycontent: 'center', height: '35px', padding: '0 0.85rem', marginTop: '0.25rem', fontWeight: 600, color: pppMode ? 'var(--color-primary)' : 'var(--text-primary)', borderColor: pppMode ? 'var(--color-primary)' : 'var(--border-color)', background: pppMode ? 'rgba(99, 102, 241, 0.15)' : 'transparent' }}>
              {pppMode ? 'ON (PPP $)' : 'OFF'}
            </button>
          </div>
          <div className="preset-selector">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Theme</span>
            <select value={theme} onChange={(e) => handleThemeChange(e.target.value)} style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', marginTop: '0.25rem', display: 'block', height: '35px', width: '110px' }}>
              <option value="system">💻 System</option>
              <option value="dark">🌙 Dark</option>
              <option value="light">☀️ Light</option>
            </select>
          </div>
          <div className="preset-selector" style={{ minWidth: 'auto' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Reference</span>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
              <button onClick={() => setShowRatesModal(true)} className="preset-btn" style={{ display: 'flex', alignItems: 'center', justifycontent: 'center', height: '35px', padding: '0 0.85rem', fontWeight: 600 }}>💱 Exchange Rates</button>
              <button onClick={() => setShowPppModal(true)} className="preset-btn" style={{ display: 'flex', alignItems: 'center', justifycontent: 'center', height: '35px', padding: '0 0.85rem', fontWeight: 600 }}>📊 PPP Factors</button>
            </div>
          </div>
        </div>
      </header>
      <DashboardStats salaryEvents={salaryEvents} compEvents={compEvents} currency={currency} pppMode={pppMode} exchangeRates={exchangeRates} pppFactors={pppFactors} />
      <div className="dashboard-grid">
        <div className="main-content">
          <CompChart salaryEvents={salaryEvents} compEvents={compEvents} startDate={startDate} currency={currency} userName={userName} onOpenShareCard={() => setShowShareModal(true)} pppMode={pppMode} exchangeRates={exchangeRates} pppFactors={pppFactors} />
        </div>
        <aside className="sidebar-panel">
          {/* User Profile Dropdown Widget */}
          <div className="profile-dropdown-container" style={{ position: 'relative', width: '100%' }}>
            <button 
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              className="profile-dropdown-trigger"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  flexShrink: 0
                }}>
                  {userName ? userName[0] : 'U'}
                </div>
                <div style={{ textAlign: 'left', minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {userName}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Active Account
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', transform: showProfileDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                <span style={{ fontSize: '0.6rem' }}>▼</span>
              </div>
            </button>
            
            {showProfileDropdown && (
              <div 
                style={{
                  position: 'absolute',
                  top: '105%',
                  left: 0,
                  right: 0,
                  background: 'var(--bg-card)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
                  zIndex: 100,
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  animation: 'fadeIn 0.2s ease-out'
                }}
              >
                <button
                  onClick={() => {
                    handleOpenUserModal();
                    setShowProfileDropdown(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0.6rem 0.75rem',
                    background: 'none',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.2s ease'
                  }}
                  className="dropdown-item"
                >
                  ⚙️ Edit Profile & Settings
                </button>
                <button
                  onClick={() => {
                    handleLogout();
                    setShowProfileDropdown(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0.6rem 0.75rem',
                    background: 'none',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#f87171',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.2s ease'
                  }}
                  className="dropdown-item text-danger"
                >
                  🚪 Log Out
                </button>
              </div>
            )}
          </div>

          <EventForm salaryEvents={salaryEvents} compEvents={compEvents} onAddSalaryEvent={handleAddSalaryEvent} onAddCompEvent={handleAddCompEvent} onEditSalaryEvent={handleEditSalaryEvent} onEditCompEvent={handleEditCompEvent} onDeleteSalaryEvent={handleDeleteSalaryEvent} onDeleteCompEvent={handleDeleteCompEvent} startDate={startDate} currency={currency} />
        </aside>
      </div>
      <ShareCardModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} salaryEvents={salaryEvents} compEvents={compEvents} startDate={startDate} currency={currency} userName={userName} pppMode={pppMode} exchangeRates={exchangeRates} pppFactors={pppFactors} />

      {/* Nominal Exchange Rates Modal */}
      {showRatesModal && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content size-md glass-panel animate-fade-in" style={{ position: 'relative' }}>
            <button onClick={() => setShowRatesModal(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Close"><X size={18} /></button>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontWeight: '700', fontSize: '1.25rem', color: 'var(--text-primary)' }}>💱 Active Nominal Exchange Rates</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-primary)', marginBottom: '0.75rem' }}>💵 Exchange Rates (Relative to 1 USD)</h3>
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
            <div style={{ marginTop: '1.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>Rates are fetched and cached daily according to your cache policy.</div>
          </div>
        </div>
      )}

      {/* World Bank PPP Factors Modal */}
      {showPppModal && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content size-md glass-panel animate-fade-in" style={{ position: 'relative' }}>
            <button onClick={() => setShowPppModal(false)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Close"><X size={18} /></button>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontWeight: '700', fontSize: '1.25rem', color: 'var(--text-primary)' }}>📊 World Bank PPP Factors Reference</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-primary)', marginBottom: '0.75rem' }}>📈 World Bank PPP Factors (LCU per PPP $)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.5rem' }}>
                  {COUNTRIES.map(c => (
                    <div key={c.code} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem', textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}><span>{c.flag}</span> <span>{c.code}</span></div>
                      <div style={{ color: 'var(--text-primary)', marginTop: '0.15rem', fontWeight: '700' }}>{pppFactors[c.code] ? Number(pppFactors[c.code]).toFixed(3) : DEFAULT_PPP_FACTORS[c.code]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: '1.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>PPP Factors are cached dynamically according to your cache policy.</div>
          </div>
        </div>
      )}
    </div>
  );
}
