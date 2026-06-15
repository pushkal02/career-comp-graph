import { useState, useEffect } from 'react';
import CompChart from './components/CompChart';
import EventForm from './components/EventForm';
import DashboardStats from './components/DashboardStats';
import { Sparkles, X, LogOut, Eye, EyeOff, Check } from 'lucide-react';
import ShareCardModal from './components/ShareCardModal';
import AuthScreen from './components/AuthScreen';
import OnboardingPanel from './components/OnboardingPanel';
import api from './utils/api';
import { EXCHANGE_RATES, DEFAULT_PPP_FACTORS, COUNTRIES } from './utils/currency';
import { parseCSVFile } from './utils/csvParser';
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

  const [hasGuestData, setHasGuestData] = useState(() => {
    try {
      const savedSalary = localStorage.getItem('comp_graph_salary_events');
      return savedSalary && JSON.parse(savedSalary).length > 0;
    } catch (err) {
      console.warn('Error reading local storage guest data:', err);
      return false;
    }
  });

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

  const handleResetData = async () => {
    if (!window.confirm('WARNING: Are you sure you want to permanently delete all salary and compensation events? This action cannot be undone.')) {
      return;
    }
    try {
      await handleBulkSync([], []);
      alert('All career progression data has been reset.');
    } catch (err) {
      alert(`Failed to reset data: ${err.message}`);
    }
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

  const handleImportCSV = (parsedData) => handleBulkSync(parsedData.salaryEvents, parsedData.compEvents);

  const handleImportJSON = async ({ userName: importedName, salaryEvents: parsedSalary, compEvents: parsedComp, startDate: parsedStart, currency: parsedCurr }) => {
    try {
      await api.events.syncEvents(parsedSalary, parsedComp);
      setSalaryEvents(parsedSalary);
      setCompEvents(parsedComp);
      const updates = {};
      if (importedName) { updates.name = importedName; setUserName(importedName); }
      if (parsedStart) { updates.startDate = parsedStart; setStartDate(parsedStart); }
      if (parsedCurr) { updates.currency = parsedCurr; setCurrency(parsedCurr); }
      if (Object.keys(updates).length > 0) await api.auth.updateSettings(updates);
    } catch (err) { alert(`Import failed: ${err.message}`); }
  };

  const handleMigrateGuestData = async () => {
    try {
      const savedSalary = JSON.parse(localStorage.getItem('comp_graph_salary_events') || '[]');
      const savedComp = JSON.parse(localStorage.getItem('comp_graph_comp_events') || '[]');
      await api.events.syncEvents(savedSalary, savedComp);
      setSalaryEvents(savedSalary);
      setCompEvents(savedComp);
      localStorage.removeItem('comp_graph_salary_events');
      localStorage.removeItem('comp_graph_comp_events');
      setHasGuestData(false);
    } catch (err) { alert(`Migration failed: ${err.message}`); }
  };

  const handleClearAll = async () => {
    if (window.confirm("Clear all data?")) {
      try {
        await api.events.syncEvents([], []);
        setSalaryEvents([]);
        setCompEvents([]);
      } catch (err) { alert(`Failed: ${err.message}`); }
    }
  };

  if (!token) return <AuthScreen onAuthSuccess={handleAuthSuccess} />;

  return (
    <div className="app-container">
      {salaryEvents.length === 0 && (
        <OnboardingPanel onImportCSV={handleImportCSV} onImportJSON={handleImportJSON} onMigrateGuest={handleMigrateGuestData} hasGuestData={hasGuestData} />
      )}
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
                <form onSubmit={handleUserSubmit} style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" value={modalName} onChange={(e) => setModalName(e.target.value)} required style={{ flex: 1, padding: '0.5rem 0.75rem', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }} />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>Save Name</button>
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

              {/* Section 3: Data Actions (Import/Reset) */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Data Maintenance & Portability</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {/* CSV Importer */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Import CSV File</span>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Upload CSV spreadsheet matching exported columns.</p>
                      <input 
                        type="file" 
                        accept=".csv" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const parsed = await parseCSVFile(file);
                            if (parsed.salaryEvents.length === 0 && parsed.compEvents.length === 0) {
                              throw new Error('No valid events found in CSV.');
                            }
                            await handleImportCSV(parsed);
                            alert('Data imported successfully from CSV!');
                          } catch (err) {
                            alert(`CSV Import failed: ${err.message}`);
                          }
                          e.target.value = '';
                        }} 
                        style={{ fontSize: '0.75rem', marginTop: 'auto', display: 'block', width: '100%' }} 
                      />
                    </div>

                    {/* JSON Importer */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Import JSON Backup</span>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Restore complete database history from JSON backup.</p>
                      <input 
                        type="file" 
                        accept=".json" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = async (event) => {
                            try {
                              const parsed = JSON.parse(event.target.result);
                              await handleImportJSON({
                                userName: parsed.userName || '',
                                salaryEvents: parsed.salaryEvents || [],
                                compEvents: parsed.compEvents || [],
                                startDate: parsed.startDate || '2024-01',
                                currency: parsed.currency || 'USD'
                              });
                              alert('Data imported successfully from JSON!');
                            } catch (err) {
                              alert(`JSON Import failed: ${err.message}`);
                            }
                          };
                          reader.readAsText(file);
                          e.target.value = '';
                        }} 
                        style={{ fontSize: '0.75rem', marginTop: 'auto', display: 'block', width: '100%' }} 
                      />
                    </div>
                  </div>

                  {/* Reset Data Button */}
                  <div style={{ background: 'rgba(239, 68, 68, 0.02)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginTop: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f87171' }}>Reset Profile Data</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Delete all history milestones permanently. This cannot be undone.</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={handleResetData}
                      style={{ background: '#ef4444', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Reset Data
                    </button>
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
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Account: <strong style={{ color: 'var(--text-secondary)' }}>{userName}</strong> • <button onClick={() => setShowUserModal(true)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600, padding: 0 }}>Edit Profile</button> • <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#f87171', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600, padding: 0 }}><LogOut size={11} /> Log Out</button>
          </p>
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
          <EventForm salaryEvents={salaryEvents} compEvents={compEvents} onAddSalaryEvent={handleAddSalaryEvent} onAddCompEvent={handleAddCompEvent} onEditSalaryEvent={handleEditSalaryEvent} onEditCompEvent={handleEditCompEvent} onDeleteSalaryEvent={handleDeleteSalaryEvent} onDeleteCompEvent={handleDeleteCompEvent} startDate={startDate} currency={currency} onClearAll={handleClearAll} />
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
