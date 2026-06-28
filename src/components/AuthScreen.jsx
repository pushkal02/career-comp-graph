import { useState } from 'react';
import { Shield, Sparkles, KeyRound, UserPlus, LogIn, ArrowRight, Eye, EyeOff, Check, X } from 'lucide-react';
import api from '../utils/api';
import { sha256 } from '../utils/crypto';

export default function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [transitHash, setTransitHash] = useState('');

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password strength checklist rules
  const passwordCriteria = [
    { id: 'length', label: 'Min 8 characters', met: password.length >= 8 },
    { id: 'uppercase', label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { id: 'lowercase', label: 'One lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { id: 'number', label: 'One number (0-9)', met: /[0-9]/.test(password) },
    { id: 'special', label: 'One special character', met: /[^A-Za-z0-9]/.test(password) }
  ];

  const isPasswordStrong = passwordCriteria.every(c => c.met);

  const isFormValid = isLogin 
    ? (username && password) 
    : (username && email && password && confirmPassword && name && isPasswordStrong);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!isFormValid) {
      setError('Please satisfy all password requirements and fill in all fields.');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Pre-hash password on client-side before sending it over the network
      const networkHash = await sha256(password);

      if (isLogin) {
        const data = await api.auth.login(username, networkHash);
        onAuthSuccess(data.token, data.user);
      } else {
        const data = await api.auth.signup(username, email, networkHash, name);
        onAuthSuccess(data.token, data.user);
      }
    } catch (err) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (loginMode) => {
    setIsLogin(loginMode);
    setError('');
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setTransitHash('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Card Header */}
        <div className="auth-header">
          <div className="auth-logo-circle">
            <Shield className="auth-logo-icon" size={32} />
          </div>
          <h2>CompGraph</h2>
          <p className="auth-subtitle">
            Secure client-to-cloud career progression plotting
          </p>
        </div>

        {/* Form Tabs */}
        <div className="auth-tabs">
          <button 
            type="button" 
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => handleTabChange(true)}
          >
            <LogIn size={14} style={{ marginRight: '6px' }} />
            Login
          </button>
          <button 
            type="button" 
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => handleTabChange(false)}
          >
            <UserPlus size={14} style={{ marginRight: '6px' }} />
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error-msg">{error}</div>}

          {!isLogin && (
            <div className="auth-field-group">
              <label htmlFor="auth-name">Your Name</label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pushkal Dev"
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="auth-field-group">
            <label htmlFor="auth-username">{isLogin ? 'Username or Email' : 'Username'}</label>
            <input
              id="auth-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isLogin ? "e.g. pushkal@example.com or pushkal_dev" : "e.g. pushkal_dev"}
              autoComplete="username"
              required
            />
          </div>

          {!isLogin && (
            <div className="auth-field-group">
              <label htmlFor="auth-email">Email Address</label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. pushkal@example.com"
                autoComplete="email"
                required
              />
            </div>
          )}

          <div className="auth-field-group">
            <label htmlFor="auth-password">Password</label>
            <div className="password-input-container" style={{ position: 'relative' }}>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  const val = e.target.value;
                  setPassword(val);
                  if (val) {
                    sha256(val).then(setTransitHash);
                  } else {
                    setTransitHash('');
                  }
                }}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                className="password-reveal-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {!isLogin && password && (
            <div className={`password-strength-checklist ${isPasswordStrong ? 'strong' : ''}`}>
              <div className="password-strength-header">
                <span>Password Strength</span>
                <span className={`password-strength-status ${isPasswordStrong ? 'strong' : 'weak'}`}>
                  {isPasswordStrong ? 'Strong' : 'Weak - Need Strong Password'}
                </span>
              </div>
              <ul className="password-criteria-list">
                {passwordCriteria.map((c) => (
                  <li key={c.id} className={`password-criteria-item ${c.met ? 'met' : 'unmet'}`}>
                    {c.met ? <Check size={12} /> : <X size={12} />}
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!isLogin && (
            <div className="auth-field-group">
              <label htmlFor="auth-confirm-password">Confirm Password</label>
              <div className="password-input-container" style={{ position: 'relative' }}>
                <input
                  id="auth-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  className="password-reveal-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  title={showConfirmPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Cryptographic Hash Feedback Panel */}
          {transitHash && (
            <div className="auth-hash-panel">
              <div className="auth-hash-header">
                <KeyRound size={12} style={{ color: 'var(--color-base)' }} />
                <span>One-Way Transit Fingerprint (SHA-256)</span>
              </div>
              <div className="auth-hash-value" title={transitHash}>
                {transitHash}
              </div>
              <p className="auth-hash-note">
                Security confirmation: plaintext passwords are never saved. Only this secure, irreversible salt-hashed digest is verified on the database.
              </p>
            </div>
          )}

          <button type="submit" className="auth-submit-btn" disabled={loading || !isFormValid}>
            {loading ? (
              <span className="spinner"></span>
            ) : (
              <>
                {isLogin ? 'Access Dashboard' : 'Create Account'}
                <ArrowRight size={14} style={{ marginLeft: '8px' }} />
              </>
            )}
          </button>
        </form>

        {/* Onboarding Notice */}
        <div className="auth-footer-note">
          <Sparkles size={12} style={{ color: 'var(--color-base)', marginRight: '6px' }} />
          <span>Session persisted securely for 30 days.</span>
        </div>
      </div>
    </div>
  );
}
