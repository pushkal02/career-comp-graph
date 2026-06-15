import { useState, useRef } from 'react';
import { PlusCircle, FileSpreadsheet, Upload, Sparkles, CloudLightning, ShieldCheck } from 'lucide-react';
import { parseCSVFile } from '../utils/csvParser';

export default function OnboardingPanel({ 
  onStartManual, 
  onImportCSV, 
  onImportJSON, 
  onMigrateGuest, 
  hasGuestData 
}) {
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  
  const csvInputRef = useRef(null);
  const jsonInputRef = useRef(null);

  const handleCSVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setImporting(true);
    try {
      const parsed = await parseCSVFile(file);
      if (parsed.salaryEvents.length === 0 && parsed.compEvents.length === 0) {
        throw new Error('No valid salary or compensation events found in the CSV file.');
      }
      onImportCSV(parsed);
    } catch (err) {
      setError(err.message || 'Failed to parse CSV file.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleJSONUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.salaryEvents || !Array.isArray(parsed.salaryEvents)) {
          throw new Error('Invalid backup: salaryEvents is missing.');
        }
        if (!parsed.compEvents || !Array.isArray(parsed.compEvents)) {
          throw new Error('Invalid backup: compEvents is missing.');
        }

        onImportJSON({
          userName: parsed.userName || '',
          salaryEvents: parsed.salaryEvents,
          compEvents: parsed.compEvents,
          startDate: parsed.startDate || '2024-01',
          currency: parsed.currency || 'USD'
        });
      } catch (err) {
        setError(err.message || 'Failed to parse JSON file.');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        {/* Header */}
        <div className="onboarding-header">
          <div className="onboarding-icon-wrapper">
            <Sparkles size={24} className="sparkles-icon" />
          </div>
          <h2>Welcome to CompGraph</h2>
          <p>Your career timeline is empty. Choose how you would like to populate your compensation history.</p>
        </div>

        {error && <div className="onboarding-error-msg">{error}</div>}

        {/* Options Grid */}
        <div className="onboarding-grid">
          {/* Option A: Start Fresh */}
          <div className="onboarding-option-card" onClick={onStartManual}>
            <div className="option-icon-circle green">
              <PlusCircle size={20} />
            </div>
            <h3>Start Fresh</h3>
            <p>Manually enter your salary milestones and bonuses using the sidebar form.</p>
            <button className="option-btn">Start Entry</button>
          </div>

          {/* Option B: Import CSV */}
          <div 
            className="onboarding-option-card" 
            onClick={() => csvInputRef.current?.click()}
          >
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleCSVUpload}
              disabled={importing}
            />
            <div className="option-icon-circle purple">
              <FileSpreadsheet size={20} />
            </div>
            <h3>Import CSV</h3>
            <p>Upload a standard CSV spreadsheet matching our exported columns to load your timeline.</p>
            <button className="option-btn" disabled={importing}>
              {importing ? 'Importing...' : 'Upload CSV'}
            </button>
          </div>

          {/* Option C: Import JSON */}
          <div 
            className="onboarding-option-card" 
            onClick={() => jsonInputRef.current?.click()}
          >
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleJSONUpload}
            />
            <div className="option-icon-circle blue">
              <Upload size={20} />
            </div>
            <h3>Import JSON</h3>
            <p>Restore your complete database, layout settings, and user profile from a JSON backup.</p>
            <button className="option-btn">Upload JSON</button>
          </div>
        </div>

        {/* Option D: Migrate Guest Data (Conditional) */}
        {hasGuestData && (
          <div className="onboarding-migration-panel" onClick={onMigrateGuest}>
            <div className="migration-icon-circle">
              <CloudLightning size={16} />
            </div>
            <div className="migration-text">
              <h4>Guest Timeline Detected!</h4>
              <p>Migrate the compensation entries stored in your local browser cache directly into your new account.</p>
            </div>
            <button className="migration-btn">
              <ShieldCheck size={14} style={{ marginRight: '6px' }} />
              Migrate Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
